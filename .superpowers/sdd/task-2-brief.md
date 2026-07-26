### Task 2: Persona Card + List Components

**Files:**
- Modify: `/usr/local/devel/sure-examples/chatbot/public/index.html`
- Modify: `/usr/local/devel/sure-examples/chatbot/tests/test_chatbot.py`

- [ ] **Step 1: Add persona list CSS**

```css
.persona-card { display:flex; align-items:center; gap:0.625rem; padding:0.5rem 0.75rem; border-radius:8px; cursor:pointer; transition:background 0.15s; }
.persona-card:hover { background:var(--highlight); }
.persona-card.active { background:var(--accent); color:#fff; }
.persona-card__avatar { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700; color:#fff; flex-shrink:0; }
.persona-card__info { flex:1; min-width:0; }
.persona-card__name { font-size:0.8125rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.persona-card__desc { font-size:0.6875rem; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.persona-search { padding:0.5rem 0.75rem; margin-bottom:0.5rem; }
.persona-search input { width:100%; padding:0.375rem 0.5rem; border:1px solid var(--border); border-radius:6px; font-size:0.8125rem; background:var(--bg); color:var(--text); outline:none; }
```

- [ ] **Step 2: Replace left sidebar conversation list with persona list**

Replace the existing sidebar content:

```html
<aside class="sidebar">
  <div class="sidebar-header">
    <h1>persona-bot</h1>
    <button class="btn-icon" onclick="newConversation()" title="New chat">+</button>
  </div>
  <div class="persona-search">
    <input type="text" id="personaSearch" placeholder="Search personas..." oninput="filterPersonas(this.value)">
  </div>
  <div class="conversation-list" id="personaList"></div>
  <div style="padding:0.5rem; border-top:1px solid var(--border)">
    <button class="btn btn-secondary" style="width:100%" onclick="openPersonaEditor()">+ New Persona</button>
  </div>
  <div style="padding:0 0.5rem 0.5rem">
    <button class="btn btn-secondary" style="width:100%" onclick="togglePreviewPanel()">⚙ Settings</button>
  </div>
</aside>
```

- [ ] **Step 3: Add persona data and rendering JS**

```js
// ── Personas ──
let personas = [
  { id: '1', name: 'Support Agent', description: 'Helpful customer support', color: '#5e81ac', prompt: 'You are a helpful support agent...', model: 'gpt-4o', temperature: 0.7 },
  { id: '2', name: 'Code Reviewer', description: 'Reviews code and suggests improvements', color: '#a3be8c', prompt: 'You are an expert code reviewer...', model: 'gpt-4o', temperature: 0.3 },
  { id: '3', name: 'Creative Writer', description: 'Helps with creative writing', color: '#b48ead', prompt: 'You are a creative writing assistant...', model: 'gpt-4o', temperature: 0.9 },
]
let activePersonaId = '1'

function renderPersonas(filter) {
  const list = document.getElementById('personaList')
  const filtered = filter ? personas.filter(p => p.name.toLowerCase().includes(filter.toLowerCase())) : personas
  list.innerHTML = filtered.map(p => `
    <div class="persona-card ${p.id === activePersonaId ? 'active' : ''}" onclick="selectPersona('${p.id}')">
      <div class="persona-card__avatar" style="background:${p.color}">${p.name.split(' ').map(w => w[0]).join('').slice(0,2)}</div>
      <div class="persona-card__info">
        <div class="persona-card__name">${escHtml(p.name)}</div>
        <div class="persona-card__desc">${escHtml(p.description)}</div>
      </div>
    </div>
  `).join('')
}

function selectPersona(id) {
  activePersonaId = id
  renderPersonas(document.getElementById('personaSearch')?.value)
  const p = personas.find(p => p.id === id)
  if (p) document.getElementById('chatTitle').textContent = p.name
}

function filterPersonas(query) { renderPersonas(query) }

function openPersonaEditor(persona) {
  savePanelState({ mode: 'editor', title: persona ? 'Edit Persona' : 'New Persona', entityId: persona?.id })
  togglePreviewPanel()
}
```

- [ ] **Step 4: Add persona detail + editor to preview panel renderer**

Add cases to the `renderPanel` switch:

```js
case 'detail':
  const pd = personas.find(p => p.id === panelState.entityId)
  if (!pd) { body.innerHTML = '<p>Persona not found</p>'; break }
  body.innerHTML = `
    <div style="text-align:center;margin-bottom:1rem">
      <div style="width:48px;height:48px;border-radius:50%;background:${pd.color};color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 0.5rem;font-size:1.125rem;font-weight:700">${pd.name.split(' ').map(w => w[0]).join('').slice(0,2)}</div>
      <h3 style="font-size:1rem;font-weight:700">${escHtml(pd.name)}</h3>
      <p style="font-size:0.8125rem;color:var(--muted)">${escHtml(pd.description)}</p>
    </div>
    <div class="field"><label>System Prompt</label><div style="font-size:0.8125rem;line-height:1.5">${escHtml(pd.prompt)}</div></div>
    <div style="display:flex;gap:0.5rem;margin:0.5rem 0">
      <div class="field" style="flex:1"><label>Model</label><div style="font-size:0.875rem;font-weight:600">${escHtml(pd.model)}</div></div>
      <div class="field" style="flex:1"><label>Temperature</label><div style="font-size:0.875rem;font-weight:600">${pd.temperature}</div></div>
    </div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem">
      <button class="btn btn-primary" style="flex:1" onclick="openPersonaEditor(personas.find(p=>p.id==='${pd.id}'))">Edit</button>
      <button class="btn btn-secondary" style="flex:1" onclick="if(confirm('Delete ${escHtml(pd.name)}?')) { personas=personas.filter(p=>p.id!=='${pd.id}'); renderPersonas(); savePanelState({mode:'settings',title:'Settings'}); }">Delete</button>
    </div>`
  break

case 'editor':
  const pe = personas.find(p => p.id === panelState.entityId)
  body.innerHTML = `
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">${pe ? 'Edit Persona' : 'New Persona'}</h3>
    <div class="field"><label>Name</label><input class="sure-auth__input" id="peName" value="${pe ? escHtml(pe.name) : ''}"></div>
    <div class="field"><label>Description</label><input class="sure-auth__input" id="peDesc" value="${pe ? escHtml(pe.description) : ''}"></div>
    <div class="field"><label>Avatar Color</label><input type="color" id="peColor" value="${pe ? pe.color : '#5e81ac'}" style="width:100%;height:40px;border-radius:6px;cursor:pointer"></div>
    <div class="field"><label>System Prompt</label><textarea class="sure-auth__input" id="pePrompt" rows="4">${pe ? escHtml(pe.prompt) : ''}</textarea></div>
    <div style="display:flex;gap:0.5rem">
      <div class="field" style="flex:1"><label>Model</label><input class="sure-auth__input" id="peModel" value="${pe ? escHtml(pe.model) : 'gpt-4o'}"></div>
      <div class="field" style="flex:1"><label>Temperature</label><input class="sure-auth__input" id="peTemp" type="number" step="0.1" min="0" max="2" value="${pe ? pe.temperature : 0.7}"></div>
    </div>
    <div style="display:flex;gap:0.5rem;margin-top:1rem">
      <button class="btn btn-primary" style="flex:1" onclick="savePersona()">Save</button>
      <button class="btn btn-secondary" style="flex:1" onclick="savePanelState({mode:'detail',title:'Persona Detail',entityId:'${pe?.id || ''}'})">Cancel</button>
    </div>`
  break
```

- [ ] **Step 5: Add savePersona function**

```js
function savePersona() {
  const name = document.getElementById('peName').value.trim()
  if (!name) { showToast('error', 'Name is required'); return }
  const data = {
    name, description: document.getElementById('peDesc').value.trim(),
    color: document.getElementById('peColor').value,
    prompt: document.getElementById('pePrompt').value,
    model: document.getElementById('peModel').value || 'gpt-4o',
    temperature: parseFloat(document.getElementById('peTemp').value) || 0.7,
  }
  const existing = personas.find(p => p.id === panelState.entityId)
  if (existing) { Object.assign(existing, data) }
  else { data.id = String(Date.now()); personas.push(data) }
  renderPersonas()
  const saved = existing || personas[personas.length - 1]
  savePanelState({ mode: 'detail', title: 'Persona Detail', entityId: saved.id })
  showToast('success', existing ? 'Persona updated' : 'Persona created')
}
```

- [ ] **Step 6: Add persona selector to chat header**

Replace the `chatTitle` span with a persona selector that also shows avatar:

```html
<div style="display:flex;align-items:center;gap:0.5rem">
  <div class="persona-card__avatar" id="chatAvatar" style="width:28px;height:28px;font-size:0.625rem">SA</div>
  <h2 id="chatTitle">Support Agent</h2>
</div>
```

Update `selectPersona` to also update the chat header avatar.

- [ ] **Step 7: E2E test — persona CRUD**

```python
def test_persona_crud(mgr):
    # Login
    mgr.fill('#loginEmail', 'demo@example.com')
    mgr.fill('#loginPassword', 'demo')
    mgr.click('#loginBtn')
    time.sleep(0.5)
    # Verify persona list
    dom = mgr.get_dom()
    assert 'persona-card' in dom['data']['html'], 'Persona cards not found'
    # Create new persona
    mgr.click('button:has-text("+ New Persona")')
    time.sleep(0.3)
    dom = mrg.get_dom()
    assert 'peName' in dom['data']['html'], 'Persona editor not opened'
    return True
```

- [ ] **Step 8: Commit**

```bash
cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: persona card/list components, CRUD, detail/editor panel modes"
```

---

