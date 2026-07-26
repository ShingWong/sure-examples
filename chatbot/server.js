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

// ── sure-gentic integration ──
import { Agent, BaseSkill } from 'sure-gentic'
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
import { createEventBus } from 'sure-state'

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

// ── HTTP Router ──
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const pathname = url.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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
