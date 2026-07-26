### Task 4: Tool Browser, MCP Manager, Skill Library Panel Modes

**Files:**
- Modify: `/usr/local/devel/sure-examples/chatbot/public/index.html`
- Modify: `/usr/local/devel/sure-examples/chatbot/server.js`

- [ ] **Step 1: Add tool listing API endpoint**

```js
// GET /api/tools — list registered tools from ToolRegistryService
if (req.method === 'GET' && pathname === '/api/tools') {
  const registry = ToolRegistryService.getInstance()
  const tools = registry.listTools().map(t => ({
    name: t.name, description: t.description,
    parameters: t.parameters?.map(p => ({ name: p.name, type: p.type, required: p.required })) || [],
  }))
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ tools }))
  return
}
```

- [ ] **Step 2: Add tool browser + MCP + skill panel mode renderers**

Add to `renderPanel` switch:

```js
case 'tools':
  body.innerHTML = '<h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Available Tools</h3><div id="toolList">Loading...</div>'
  fetch('/api/tools').then(r => r.json()).then(data => {
    const list = document.getElementById('toolList')
    if (!list) return
    if (!data.tools?.length) { list.innerHTML = '<p style="color:var(--muted)">No tools registered</p>'; return }
    list.innerHTML = data.tools.map(t => `
      <div style="padding:0.75rem;border:1px solid var(--border);border-radius:8px;margin-bottom:0.5rem">
        <div style="font-weight:600;font-size:0.875rem">${escHtml(t.name)}</div>
        <div style="font-size:0.75rem;color:var(--muted);margin-top:0.25rem">${escHtml(t.description)}</div>
        ${t.parameters?.length ? `<div style="margin-top:0.5rem;font-size:0.6875rem;color:var(--muted)">Params: ${t.parameters.map(p => p.name + (p.required ? '*' : '')).join(', ')}</div>` : ''}
      </div>
    `).join('')
  }).catch(() => { const l = document.getElementById('toolList'); if (l) l.innerHTML = '<p style="color:var(--error)">Failed to load tools</p>' })
  break

case 'mcp':
  body.innerHTML = `
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">MCP Servers</h3>
    <p style="font-size:0.8125rem;color:var(--muted);margin-bottom:1rem">Configure MCP server connections for external tools.</p>
    <div class="field"><label>Server Name</label><input class="sure-auth__input" id="mcpName" placeholder="my-server"></div>
    <div class="field"><label>Command</label><input class="sure-auth__input" id="mcpCmd" placeholder="node server.js"></div>
    <button class="sure-auth__btn" onclick="showToast('info','MCP server management coming in persona-bot')">Add Server</button>
  `
  break

case 'skills':
  body.innerHTML = `
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">Skill Library</h3>
    <p style="font-size:0.8125rem;color:var(--muted)">Available BaseSkill implementations for agent orchestration.</p>
    <div style="margin-top:1rem;padding:0.75rem;border:1px solid var(--border);border-radius:8px">
      <div style="font-weight:600;font-size:0.875rem">chat</div>
      <div style="font-size:0.75rem;color:var(--muted)">Respond to user messages</div>
    </div>
    <div style="margin-top:0.5rem;padding:0.75rem;border:1px solid var(--border);border-radius:8px">
      <div style="font-weight:600;font-size:0.875rem">generate_content</div>
      <div style="font-size:0.75rem;color:var(--muted)">Generate SVG, HTML, or text content</div>
    </div>
  `
  break
```

- [ ] **Step 3: Wire tool/skill/mcp modes into the UI**

Add navigation buttons or a way to reach these modes. For now, add a quick mode switcher in the chat header:

```html
<select id="panelModeSelect" onchange="savePanelState({mode:this.value,title:this.options[this.selectedIndex].text})" style="font-size:0.75rem;padding:0.25rem 0.5rem;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text)">
  <option value="settings">Settings</option>
  <option value="tools">Tools</option>
  <option value="mcp">MCP Servers</option>
  <option value="skills">Skills</option>
  <option value="inspect">Inspect</option>
</select>
```

- [ ] **Step 4: Commit**

```bash
cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: tool browser, MCP manager, skill library panel modes"
```

---

