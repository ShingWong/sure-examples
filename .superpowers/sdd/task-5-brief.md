### Task 5: Inspect Panel Mode (sure-state debug viewer)

**Files:**
- Modify: `/usr/local/devel/sure-examples/chatbot/public/index.html`

- [ ] **Step 1: Add inspect panel renderer**

Add to `renderPanel` switch:

```js
case 'inspect':
  body.innerHTML = `
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">State Inspector</h3>
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem">
      <button class="btn btn-secondary" style="flex:1;font-size:0.75rem;padding:0.375rem" onclick="inspectCookies()">Cookies</button>
      <button class="btn btn-secondary" style="flex:1;font-size:0.75rem;padding:0.375rem" onclick="inspectConfig()">Config</button>
      <button class="btn btn-secondary" style="flex:1;font-size:0.75rem;padding:0.375rem" onclick="inspectPanel()">Panel</button>
    </div>
    <pre id="inspectOutput" style="background:var(--bg);padding:0.75rem;border-radius:6px;font-size:0.75rem;white-space:pre-wrap;overflow-x:auto;max-height:60vh"></pre>
  `
  inspectCookies()
  break
```

- [ ] **Step 2: Add inspect functions**

```js
async function inspectCookies() {
  const out = document.getElementById('inspectOutput')
  if (!out) return
  out.textContent = document.cookie.split(';').map(c => c.trim()).filter(Boolean).join('\n') || '(no cookies)'
}
async function inspectConfig() {
  const out = document.getElementById('inspectOutput')
  if (!out) return
  const res = await fetch('/api/config')
  const data = await res.json()
  out.textContent = JSON.stringify(data, null, 2)
}
async function inspectPanel() {
  const out = document.getElementById('inspectOutput')
  if (!out) return
  out.textContent = JSON.stringify(panelState, null, 2)
}
```

- [ ] **Step 3: Commit**

```bash
cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: inspect panel mode with cookie/config/state viewer"
```
