### Task 1: Preview Panel Component

**Files:**
- Modify: `/usr/local/devel/sure-examples/chatbot/server.js`
- Modify: `/usr/local/devel/sure-examples/chatbot/public/index.html`

**Interfaces:**
- Produces: Panel state store (`mode`, `contentType`, `content`), preview panel HTML/CSS, SVG renderer, HTML sandboxed iframe renderer

- [ ] **Step 1: Add panel state endpoint to server.js**

Add after the config block:

```js
// ── Panel state (preview panel content) ──
let panelState = { mode: 'settings', contentType: '', content: '', title: 'Settings' }

// GET /api/panel
if (req.method === 'GET' && pathname === '/api/panel') {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(panelState))
  return
}

// POST /api/panel
if (req.method === 'POST' && pathname === '/api/panel') {
  const body = await parseBody(req)
  Object.assign(panelState, body)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(panelState))
  return
}
```

- [ ] **Step 2: Add preview panel HTML to index.html**

Add after the settings drawer closing `</div>`:

```html
<!-- Preview panel -->
<div class="preview-panel" id="previewPanel">
  <div class="preview-panel__header">
    <span class="preview-panel__title" id="panelTitle">Settings</span>
    <button class="preview-panel__close" onclick="togglePreviewPanel()">✕</button>
  </div>
  <div class="preview-panel__body" id="panelBody"></div>
</div>
```

- [ ] **Step 3: Add preview panel CSS**

Add to the `<style>` block:

```css
.preview-panel { position:fixed; top:0; right:0; bottom:0; width:400px; max-width:90vw; background:var(--surface); border-left:1px solid var(--border); z-index:90; display:flex; flex-direction:column; transform:translateX(100%); transition:transform 0.3s; }
.preview-panel.open { transform:translateX(0); }
.preview-panel__header { padding:0.75rem 1rem; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; }
.preview-panel__title { font-size:0.875rem; font-weight:600; }
.preview-panel__close { background:none; border:none; cursor:pointer; color:var(--muted); font-size:1.25rem; }
.preview-panel__body { flex:1; overflow-y:auto; padding:1rem; }
.preview-panel__body svg { max-width:100%; height:auto; }
.preview-panel iframe { width:100%; height:100%; border:none; border-radius:6px; }
```

- [ ] **Step 4: Add panel JS functions**

Add to the `<script>` block:

```js
// ── Preview Panel ──
let panelState = { mode: 'settings', contentType: '', content: '', title: 'Settings' }

async function loadPanelState() {
  try {
    const res = await fetch('/api/panel')
    panelState = await res.json()
    renderPanel()
  } catch (e) { console.error('Panel state load failed:', e) }
}

async function savePanelState(update) {
  Object.assign(panelState, update)
  try {
    await fetch('/api/panel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(panelState) })
  } catch (e) { console.error('Panel state save failed:', e) }
  renderPanel()
}

function togglePreviewPanel() {
  document.getElementById('previewPanel').classList.toggle('open')
}

function renderPanel() {
  document.getElementById('panelTitle').textContent = panelState.title || 'Panel'
  const body = document.getElementById('panelBody')
  if (!body) return

  switch (panelState.mode) {
    case 'preview':
      if (panelState.contentType === 'svg') {
        body.innerHTML = `<div style="padding:1rem;text-align:center">${panelState.content}</div>`
      } else if (panelState.contentType === 'html') {
        body.innerHTML = `<iframe sandbox="allow-scripts" srcdoc="${escHtml(panelState.content)}"></iframe>`
      } else {
        body.innerHTML = `<pre style="white-space:pre-wrap;font-size:0.8125rem">${escHtml(panelState.content || '')}</pre>`
      }
      break
    case 'settings':
      body.innerHTML = renderSettingsPanel()
      break
    default:
      body.innerHTML = `<p style="color:var(--muted)">${panelState.content || 'No content'}</p>`
  }
}

function renderSettingsPanel() {
  return `
    <div class="field"><label>LLM Provider</label>
      <select id="provider" onchange="onConfigChange()">
        <option value="mock">Mock</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="google">Google Gemini</option>
        <option value="openai-compatible">OpenAI-compatible</option>
      </select>
    </div>
    <div class="field"><label>Model</label>
      <input type="text" id="model" placeholder="auto" onchange="onConfigChange()">
    </div>
    <div class="field"><label>Temperature: <span id="tempValue">0.7</span></label>
      <input type="range" id="temperature" min="0" max="2" step="0.1" value="0.7">
    </div>
    <div class="theme-grid" style="display:flex;gap:0.5rem">
      <button class="theme-btn active" data-theme="nord" onclick="setTheme('nord',this)" style="flex:1">Nord</button>
      <button class="theme-btn" data-theme="forest" onclick="setTheme('forest',this)" style="flex:1">Forest</button>
      <button class="theme-btn" data-theme="dracula" onclick="setTheme('dracula',this)" style="flex:1">Dracula</button>
    </div>
  `
}
```

- [ ] **Step 5: Add preview panel toggle to chat header**

In the chat header, add a button:
```html
<button class="btn-icon" onclick="togglePreviewPanel()" title="Preview panel">▶</button>
```

- [ ] **Step 6: Add agent skill for SVG/HTML generation**

In `server.js`, add a `GenerateContentSkill` that the agent uses:

```js
class GenerateContentSkill extends BaseSkill {
  name = 'generate_content'
  description = 'Generate SVG, HTML, or markdown content'
  async execute(ctx) {
    const result = await this.callLLM(this.agent, [
      { role: 'system', content: `You generate content based on user requests. 
If the user asks for an SVG, output the SVG code wrapped in \`\`\`svg...\`\`\`.
If the user asks for HTML, output the full HTML wrapped in \`\`\`html...\`\`\`.
Always produce complete, working code.` },
      { role: 'user', content: ctx.prompt },
    ])
    // Detect content type
    const svgMatch = result.match(/```svg\n?([\s\S]*?)```/)
    const htmlMatch = result.match(/```html\n?([\s\S]*?)```/)
    if (svgMatch) {
      panelState = { mode: 'preview', contentType: 'svg', content: svgMatch[1].trim(), title: 'SVG Preview', updatedAt: Date.now() }
    } else if (htmlMatch) {
      panelState = { mode: 'preview', contentType: 'html', content: htmlMatch[1].trim(), title: 'HTML Preview', updatedAt: Date.now() }
    } else {
      panelState = { mode: 'preview', contentType: 'text', content: result, title: 'Content', updatedAt: Date.now() }
    }
    return { success: true, data: result, panelState }
  }
}
```

- [ ] **Step 7: Wire the chat endpoint to use GenerateContentSkill**

Modify the `/api/chat` handler to detect content generation requests and use the new skill:

```js
// In the chat handler, before the generic ChatSkill:
const lowerMsg = message.toLowerCase()
if (lowerMsg.includes('svg') || lowerMsg.includes('logo') || lowerMsg.includes('html') || lowerMsg.includes('page') || lowerMsg.includes('quiz')) {
  const skill = new GenerateContentSkill()
  const result = await agent.run(skill, { prompt: message })
  const reply = addMessage(conversationId, 'assistant', result.data?.substring(0, 500) || result.data || 'Generated')
  // Update panel via API
  try { await fetch(`http://localhost:${PORT}/api/panel`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(panelState) }) } catch {}
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ message: reply, panelState }))
  return
}
```

- [ ] **Step 8: Load panel state on init**

Add `loadPanelState()` to the init block.

- [ ] **Step 9: E2E test — preview panel toggle**

Add to `tests/test_chatbot.py`:

```python
def test_preview_panel(mgr):
    # Login
    mgr.fill('#loginEmail', 'demo@example.com')
    mgr.fill('#loginPassword', 'demo')
    mgr.click('#loginBtn')
    time.sleep(0.5)
    # Open preview panel
    mgr.click('button[title="Preview panel"]')
    time.sleep(0.3)
    dom = mgr.get_dom()
    assert 'preview-panel' in dom['data']['html'], 'Preview panel not found'
    # Check settings panel renders
    assert 'LLM Provider' in dom['data']['html'], 'Settings panel content not found'
    return True
```

- [ ] **Step 10: Commit**

```bash
cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: preview panel with SVG/HTML rendering, settings panel mode"
```

---

