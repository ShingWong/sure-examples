### Task 6: Chatbot Integration

**Files:**
- Modify: `/usr/local/devel/sure-examples/chatbot/server.js`
- Modify: `/usr/local/devel/sure-examples/chatbot/public/index.html`

- [ ] **Step 1: Update server.js to add auth endpoints**

Add before the `// ── HTTP Router ──` section:

```js
// ── Auth (built-in SimpleAuth via sure-state) ──
import { createSimpleAuth } from 'sure-state'

const auth = createSimpleAuth({
  passwordPolicy: { minLength: 4, requireUpper: false, requireDigit: false },
  rateLimit: { maxAttempts: 5, windowMs: 60000, banMs: 60000 },
  cookies: { name: 'sure_session', path: '/', secure: false },
})

// Auto-create demo user in mock mode
if (currentConfig.provider === 'mock') {
  auth.register({ email: 'demo@example.com', password: 'demo' }).catch(() => {})
}
```

Add auth routes in the router section:

```js
// POST /api/auth/register
if (req.method === 'POST' && pathname === '/api/auth/register') {
  const body = await parseBody(req)
  try {
    const session = await auth.register({ email: body.email, password: body.password })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ identity: session.identity }))
  } catch (err) {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
  return
}

// POST /api/auth/login
if (req.method === 'POST' && pathname === '/api/auth/login') {
  const body = await parseBody(req)
  try {
    const session = await auth.login({ email: body.email, password: body.password })
    res.setHeader('Set-Cookie', `sure_session=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ identity: session.identity }))
  } catch (err) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
  return
}

// POST /api/auth/logout
if (req.method === 'POST' && pathname === '/api/auth/logout') {
  const cookie = parseCookies(req.headers.cookie || '')
  if (cookie.sure_session) await auth.logout(cookie.sure_session)
  res.setHeader('Set-Cookie', 'sure_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0')
  res.writeHead(200)
  res.end('{}')
  return
}

// GET /api/auth/session
if (req.method === 'GET' && pathname === '/api/auth/session') {
  const cookie = parseCookies(req.headers.cookie || '')
  if (cookie.sure_session) {
    const session = await auth.getSession(cookie.sure_session)
    if (session) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ identity: session.identity }))
      return
    }
  }
  res.writeHead(401)
  res.end(JSON.stringify({ error: 'Not authenticated' }))
  return
}
```

Add the cookie parser helper near the top of server.js:

```js
function parseCookies(cookieHeader) {
  const result = {}
  if (!cookieHeader) return result
  cookieHeader.split(';').forEach(pair => {
    const eq = pair.indexOf('=')
    if (eq === -1) return
    result[pair.slice(0, eq).trim()] = decodeURIComponent(pair.slice(eq + 1).trim())
  })
  return result
}
```

- [ ] **Step 2: Move existing chat routes behind auth check**

Wrap the chat/conversation routes with a session check. If no valid session cookie, return 401. The login page is served without auth.

- [ ] **Step 3: Update index.html to add login page**

Add a login form at the top of the HTML body (before `.app`). Show it when not authenticated:

```html
<div id="authPage" class="sure-auth__form">
  <div class="sure-auth__header">
    <h1>sure-chatbot</h1>
    <p>Sign in to continue</p>
  </div>
  <div id="authAlert"></div>
  <div class="sure-auth__field">
    <label class="sure-auth__label">Email</label>
    <input class="sure-auth__input" id="loginEmail" type="email" placeholder="demo@example.com" autocomplete="email">
  </div>
  <div class="sure-auth__field">
    <label class="sure-auth__label">Password</label>
    <input class="sure-auth__input" id="loginPassword" type="password" placeholder="••••••••" autocomplete="current-password">
  </div>
  <button class="sure-auth__btn" id="loginBtn" onclick="login()">Sign In</button>
  <div class="sure-auth__footer">
    Don't have an account? <a href="#" onclick="showRegister()">Register</a>
  </div>
</div>
```

Add corresponding JS functions:

```js
// ── Auth ──
let currentIdentity = null

async function checkSession() {
  try {
    const res = await fetch('/api/auth/session')
    if (res.ok) {
      const data = await res.json()
      currentIdentity = data.identity
      return true
    }
  } catch {}
  return false
}

async function login() {
  const email = document.getElementById('loginEmail').value
  const password = document.getElementById('loginPassword').value
  const btn = document.getElementById('loginBtn')
  btn.disabled = true; btn.textContent = 'Signing in...'
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    currentIdentity = data.identity
    document.getElementById('authPage').style.display = 'none'
    document.getElementById('app').style.display = 'flex'
    initChat()
  } catch (e) {
    showToast('error', e.message)
  } finally {
    btn.disabled = false; btn.textContent = 'Sign In'
  }
}
```

Wrap the chat init to check auth first:

```js
// Replace the current init block with:
;(async () => {
  loadConfig()
  const authed = await checkSession()
  if (authed) {
    document.getElementById('authPage').style.display = 'none'
    document.getElementById('app').style.display = 'flex'
    initChat()
  } else {
    document.getElementById('authPage').style.display = 'block'
    document.getElementById('app').style.display = 'none'
  }
})()

function initChat() {
  if (conversations.length === 0) {
    newConversation()
  } else {
    renderConversations()
    activeConversationId = conversations[0].id
    renderConversations()
    const conv = conversations[0]
    document.getElementById('chatTitle').textContent = conv ? conv.title : 'Chat'
    renderMessages(activeConversationId)
    document.getElementById('messageInput').disabled = false
    document.getElementById('sendBtn').disabled = false
    setStatus('connected', 'Ready')
  }
}
```

Also add the `showRegister()` function:

```js
function showRegister() {
  document.getElementById('authPage').innerHTML = `
    <div class="sure-auth__header">
      <h1>Create Account</h1>
      <p>Enter your details to get started</p>
    </div>
    <div id="authAlert"></div>
    <div class="sure-auth__field">
      <label class="sure-auth__label">Email</label>
      <input class="sure-auth__input" id="regEmail" type="email" placeholder="you@example.com">
    </div>
    <div class="sure-auth__field">
      <label class="sure-auth__label">Password</label>
      <input class="sure-auth__input" id="regPassword" type="password" placeholder="At least 4 characters">
    </div>
    <button class="sure-auth__btn" onclick="register()">Create Account</button>
    <div class="sure-auth__footer">
      Already have an account? <a href="#" onclick="showLogin()">Sign in</a>
    </div>
  `
}

function showLogin() {
  location.reload()  // Simple reload to reset the auth page
}
```

- [ ] **Step 4: Reinstall deps, start server, verify**

```bash
cd /usr/local/devel/sure-examples/chatbot && npm install
# Restart the chatbot tmux session
tmux kill-session -t chatbot 2>/dev/null
tmux new-session -d -s chatbot 'cd /usr/local/devel/sure-examples/chatbot && npx tsx server.js'
sleep 3
curl -s http://localhost:3001/ | head -5
```
Expected: Auth page HTML shown.

- [ ] **Step 5: Run E2E tests (update the test to handle auth)**

```bash
cd /usr/local/devel/sure-examples/chatbot && .venv/bin/python tests/run_tests.py
```
Expected: Tests may need updates to handle login flow.

- [ ] **Step 6: Commit**

```bash
cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: add login wall to chatbot using sure-state SimpleAuth" && git push
```

---

