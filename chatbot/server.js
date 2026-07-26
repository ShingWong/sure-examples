/**
 * sure-chatbot — lightweight in-memory chatbot server
 *
 * Showcases:
 *   sure-gentic — LLM provider abstraction (OpenAI, Anthropic, mock)
 *   sure-state  — in-memory entity store for conversation management
 *   sure-ui     — theme CSS injection
 *
 * Dependencies beyond sure-*: zero (uses Node.js built-in http, fs, url)
 *
 * Run:
 *   npm install
 *   node server.js
 *   → http://localhost:3001
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, 'public')

// ── Helper: JSON body parser ──
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', c => body += c)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) } catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

// ── Helper: cookie parser ──
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

// ── Helper: serve static file ──
function serveStatic(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  }
  const fullPath = path.join(PUBLIC, filePath)
  if (!fullPath.startsWith(PUBLIC)) {
    res.writeHead(403); res.end('Forbidden')
    return
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(404)
      res.end('Not found')
      return
    }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' })
    res.end(data)
  })
}

// ── Server state ──
let conversations = []
let messageIdCounter = 0

// Current config — updated via POST /api/config
let currentConfig = {
  provider: 'mock',
  apiKey: '',
  model: '',
  temperature: 0.7,
  theme: 'nord',
  baseUrl: '',
  label: '',
}

// ── API Key Encryption ──

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

// ── Auth (built-in SimpleAuth via sure-state) ──

const auth = createSimpleAuth({
  passwordPolicy: { minLength: 4, requireUpper: false, requireDigit: false },
  rateLimit: { maxAttempts: 5, windowMs: 60000, banMs: 60000 },
  cookies: { name: 'sure_session', path: '/', secure: false },
})

// Auto-create demo user in mock mode
if (currentConfig.provider === 'mock') {
  auth.register({ email: 'demo@example.com', password: 'demo' }).catch(() => {})
}

// ── sure-gentic integration ──
import { Agent, BaseSkill, ToolRegistryService } from 'sure-gentic'
import { LLMProviderFactory, OpenAIProvider, AnthropicProvider, GoogleProvider, OpenAICompatibleProvider, MockProvider } from 'sure-gentic'

let agent = null

async function getAgent(config) {
  const factory = LLMProviderFactory.getInstance()
  factory.clear()

  if (config.provider === 'mock' || config.provider === '') {
    process.env.AI_PROVIDER = 'mock'
    factory.register(new MockProvider())
  } else if (config.provider === 'openai') {
    process.env.OPENAI_API_KEY = config.apiKey
    factory.register(new OpenAIProvider(config.apiKey))
    process.env.AI_PROVIDER = 'openai'
  } else if (config.provider === 'anthropic') {
    process.env.ANTHROPIC_API_KEY = config.apiKey
    factory.register(new AnthropicProvider(config.apiKey))
    process.env.AI_PROVIDER = 'anthropic'
  } else if (config.provider === 'google') {
    process.env.GOOGLE_API_KEY = config.apiKey
    factory.register(new GoogleProvider(config.apiKey))
    process.env.AI_PROVIDER = 'google'
  } else if (config.provider === 'openai-compatible') {
    process.env.OPENAI_API_KEY = config.apiKey
    process.env.VISION_BASE_URL = config.baseUrl
    factory.register(new OpenAICompatibleProvider({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      defaultModel: config.model || 'gpt-4o',
      label: config.label || 'custom',
    }))
    process.env.AI_PROVIDER = 'openai-compatible'
  }
  if (config.model) process.env.AI_MODEL = config.model
  process.env.AI_TEMPERATURE = String(config.temperature)
  return new Agent()
}

// ── sure-state integration ──
// Using the store pattern: in-memory conversation state
// (In a real app, use createEntityStore from sure-state with an API adapter)
// Here we use a simple mutable store for the in-memory example.
// The same pattern scales to sure-state's createEntityStore when adding persistence.
import { createEventBus, createSimpleAuth } from 'sure-state'

const bus = createEventBus()
bus.on('action', (record) => console.log('[store]', record.kind, record.detail || ''))
bus.on('error', ({ message }) => console.error('[store] error:', message))

function addMessage(conversationId, role, content) {
  const conv = conversations.find(c => c.id === conversationId)
  if (!conv) throw new Error(`Conversation ${conversationId} not found`)
  const message = { id: String(++messageIdCounter), role, content, timestamp: Date.now() }
  conv.messages.push(message)
  // Emit store event (sure-state event bus pattern)
  bus.emit('action', {
    kind: 'create', entityName: 'message', success: true,
    id: '', timestamp: Date.now(), durationMs: 0,
    detail: `${role}: ${content.slice(0, 60)}...`,
  })
  return message
}

// ── GenerateContentSkill (used for SVG/HTML generation) ──
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

// ── Panel state (preview panel content) ──
let panelState = { mode: 'preview', contentType: '', content: '', title: 'Content Preview' }

// ── HTTP Router ──
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  try {
    // ── API routes ──

    // GET /api/config — get current config
    if (req.method === 'GET' && pathname === '/api/config') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(currentConfig))
      return
    }

    // POST /api/config — update config
    if (req.method === 'POST' && pathname === '/api/config') {
      const body = await parseBody(req)
      Object.assign(currentConfig, body)
      agent = await getAgent(currentConfig)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, config: currentConfig }))
      return
    }

    // GET /api/panel — get panel state
    if (req.method === 'GET' && pathname === '/api/panel') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(panelState))
      return
    }

    // POST /api/panel — update panel state
    if (req.method === 'POST' && pathname === '/api/panel') {
      const body = await parseBody(req)
      Object.assign(panelState, body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(panelState))
      return
    }

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

    // ── Key management routes ──

    // GET /api/keys — list configured providers with masked keys
    if (req.method === 'GET' && pathname === '/api/keys') {
      const providers = Object.entries(keyStore).map(([provider, data]) => ({
        provider,
        status: 'configured',
        masked: maskKey(decryptKey(data.key)),
        baseUrl: data.baseUrl || '',
      }))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ providers }))
      return
    }

    // POST /api/keys — add or rotate a key
    if (req.method === 'POST' && pathname === '/api/keys') {
      const body = await parseBody(req)
      const { provider, key, baseUrl } = body
      if (!provider || !key) { res.writeHead(400); res.end(JSON.stringify({ error: 'provider and key required' })); return }
      keyStore[provider] = { key: encryptKey(key), baseUrl: baseUrl || '' }
      console.log(`[key] ${provider} key ${maskKey(key)} configured${baseUrl ? ' url=' + baseUrl : ''}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ provider, status: 'configured', masked: maskKey(key), baseUrl: baseUrl || '' }))
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

    // ── Auth routes ──

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

    // GET /api/conversations — list conversations
    if (req.method === 'GET' && pathname === '/api/conversations') {
      const summary = conversations.map(c => ({
        id: c.id,
        title: c.title,
        messageCount: c.messages.length,
        createdAt: c.createdAt,
        lastMessageAt: c.messages.length > 0 ? c.messages[c.messages.length - 1].timestamp : c.createdAt,
      }))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(summary))
      return
    }

    // POST /api/conversations — create new conversation
    if (req.method === 'POST' && pathname === '/api/conversations') {
      const conv = {
        id: String(Date.now()),
        title: `Chat ${conversations.length + 1}`,
        messages: [],
        createdAt: Date.now(),
      }
      conversations.push(conv)
      bus.emit('action', { kind: 'create', entityName: 'conversation', success: true, id: '', timestamp: Date.now(), durationMs: 0, detail: conv.id })
      if (conversations.length > 50) conversations = conversations.slice(-50)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(conv))
      return
    }

    // POST /api/chat — send a message, get a response
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await parseBody(req)
      const { conversationId, message } = body

      if (!conversationId || !message) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'conversationId and message required' }))
        return
      }

      // Ensure conversation exists (client manages state via cookies; server adapts)
      let conv = conversations.find(c => c.id === conversationId)
      if (!conv) {
        conv = { id: conversationId, title: message.slice(0, 50), messages: [], createdAt: Date.now() }
        conversations.push(conv)
        if (conversations.length > 50) conversations = conversations.slice(-50)
      }

      // Add user message
      addMessage(conversationId, 'user', message)

      // Build conversation history for LLM
      conv = conversations.find(c => c.id === conversationId)
      const messages = conv.messages.map(m => ({ role: m.role, content: m.content }))

      // Call LLM via sure-gentic Agent + Skill
      try {
        if (!agent) agent = await getAgent(currentConfig)

        // Content generation detection (SVG, HTML, etc.)
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

        // Using sure-gentic's BaseSkill pattern
        class ChatSkill extends BaseSkill {
          name = 'chat'
          description = 'Respond to user message'
          async execute(ctx) {
            return this.callLLM(this.agent, ctx.messages)
          }
        }

        const skill = new ChatSkill()
        const result = await agent.run(skill, { messages })

        const content = result.success ? result.data : `Error: ${result.error}`
        const reply = addMessage(conversationId, 'assistant', content)
        conv.title = conv.messages[0]?.content?.slice(0, 50) ?? conv.title

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ message: reply }))
      } catch (err) {
        bus.emit('error', { message: err.message, kind: 'chat' })
        const reply = addMessage(conversationId, 'assistant', `Error: ${err.message}`)
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message, message: reply }))
      }
      return
    }

    // GET /api/theme — get theme CSS by name
    if (req.method === 'GET' && pathname === '/api/theme') {
      const themeName = url.searchParams.get('name') || 'nord'
      try {
        const { nord, forest, dracula } = await import('sure-ui')
        const themes = { nord, forest, dracula }
        const css = themes[themeName]
        if (!css) { res.writeHead(404); res.end('Theme not found'); return }
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' })
        res.end(css)
      } catch {
        res.writeHead(500); res.end('Theme load failed')
      }
      return
    }

    // GET / — serve index.html
    if (pathname === '/' || pathname === '') {
      serveStatic(res, 'index.html')
      return
    }

    // All other paths — try static file
    serveStatic(res, pathname)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  }
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`sure-chatbot listening on http://localhost:${PORT}`)
  console.log(`Default provider: ${currentConfig.provider} (mock mode — no API key needed)`)
  console.log(`Set provider, key, model from the settings drawer in the UI`)
})
