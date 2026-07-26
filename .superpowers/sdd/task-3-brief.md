### Task 3: API Key Encryption

**Files:**
- Modify: `/usr/local/devel/sure-examples/chatbot/server.js`
- Modify: `/usr/local/devel/sure-examples/chatbot/public/index.html`

- [ ] **Step 1: Add encryption utilities to server.js**

```js
// ── API Key Encryption ──
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ENCRYPTION_KEY = Buffer.from(process.env.API_KEY_SECRET || 'default-dev-key-change-in-production-!!', 'utf-8').slice(0, 32)
const ALGORITHM = 'aes-256-gcm'

function encryptKey(plaintext) {
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(plaintext, 'utf-8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')
  return JSON.stringify({ iv: iv.toString('hex'), encrypted, authTag })
}

function decryptKey(encoded) {
  const { iv, encrypted, authTag } = JSON.parse(encoded)
  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  let decrypted = decipher.update(encrypted, 'hex', 'utf-8')
  decrypted += decipher.final('utf-8')
  return decrypted
}

// ── Key store (in-memory, encrypted at rest) ──
const keyStore = {}  // provider → encrypted blob

function maskKey(key) {
  if (key.length <= 8) return '****'
  return key.slice(0, 3) + '...' + key.slice(-4)
}
```

- [ ] **Step 2: Add key management API endpoints**

```js
// GET /api/keys — list configured providers with masked keys
if (req.method === 'GET' && pathname === '/api/keys') {
  const providers = Object.entries(keyStore).map(([provider, encrypted]) => ({
    provider,
    status: 'configured',
    masked: maskKey(decryptKey(encrypted)),
  }))
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ providers }))
  return
}

// POST /api/keys — add or rotate a key
if (req.method === 'POST' && pathname === '/api/keys') {
  const body = await parseBody(req)
  const { provider, key } = body
  if (!provider || !key) { res.writeHead(400); res.end(JSON.stringify({ error: 'provider and key required' })); return }
  keyStore[provider] = encryptKey(key)
  // Redact from logs
  console.log(`[key] ${provider} key ${maskKey(key)} configured`)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ provider, status: 'configured', masked: maskKey(key) }))
  return
}

// DELETE /api/keys/:provider — delete a key
if (req.method === 'DELETE' && pathname.startsWith('/api/keys/')) {
  const provider = pathname.slice('/api/keys/'.length)
  delete keyStore[provider]
  res.writeHead(200)
  res.end(JSON.stringify({ ok: true }))
  return
}
```

- [ ] **Step 3: Add key-manager panel mode to frontend**

Add to `renderPanel` switch:

```js
case 'key-manager':
  body.innerHTML = `
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:1rem">API Keys</h3>
    <div id="keyList"></div>
    <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:1rem">
      <div class="field"><label>Provider</label>
        <select class="sure-auth__input" id="newKeyProvider">
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="google">Google Gemini</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>
      <div class="field"><label>API Key</label>
        <input class="sure-auth__input" type="password" id="newKeyValue" placeholder="sk-...">
      </div>
      <button class="sure-auth__btn" onclick="addApiKey()">Save Key</button>
    </div>`
  loadKeyList()
  break
```

- [ ] **Step 4: Add key management JS functions**

```js
async function loadKeyList() {
  try {
    const res = await fetch('/api/keys')
    const data = await res.json()
    const container = document.getElementById('keyList')
    if (!container) return
    if (!data.providers || data.providers.length === 0) {
      container.innerHTML = '<p style="color:var(--muted);font-size:0.875rem">No API keys configured. Add one below.</p>'
      return
    }
    container.innerHTML = data.providers.map(p => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--border)">
        <div><strong>${p.provider}</strong><br><span style="font-size:0.75rem;color:var(--muted)">${p.masked}</span></div>
        <button class="btn btn-secondary" style="padding:0.25rem 0.5rem;font-size:0.75rem" onclick="deleteKey('${p.provider}')">Remove</button>
      </div>
    `).join('')
  } catch (e) { console.error('Failed to load keys:', e) }
}

async function addApiKey() {
  const provider = document.getElementById('newKeyProvider').value
  const key = document.getElementById('newKeyValue').value.trim()
  if (!key) { showToast('error', 'Key is required'); return }
  try {
    const res = await fetch('/api/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider, key }) })
    if (!res.ok) throw new Error((await res.json()).error)
    document.getElementById('newKeyValue').value = ''
    showToast('success', `${provider} key saved`)
    loadKeyList()
  } catch (e) { showToast('error', e.message) }
}

async function deleteKey(provider) {
  try {
    await fetch(`/api/keys/${provider}`, { method: 'DELETE' })
    showToast('info', `${provider} key removed`)
    loadKeyList()
  } catch (e) { showToast('error', e.message) }
}
```

- [ ] **Step 5: E2E test — key management**

```python
def test_key_management(mgr):
    # Login
    mgr.fill('#loginEmail', 'demo@example.com')
    mgr.fill('#loginPassword', 'demo')
    mgr.click('#loginBtn')
    time.sleep(0.5)
    # Open panel
    mgr.click('button[title="Preview panel"]')
    time.sleep(0.3)
    # Navigate to key manager (via settings or direct)
    # Verify key UI is present
    dom = mrg.get_dom()
    assert 'API' in dom['data']['html'], 'Key manager not found'
    return True
```

- [ ] **Step 6: Commit**

```bash
cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: encrypted API key management with AES-256-GCM"
```

---

