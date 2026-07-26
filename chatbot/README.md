# sure-chatbot

**A lightweight in-memory chatbot showcasing the sure-\* ecosystem.** Configure LLM provider, API key, model, temperature, and theme — all from the UI. No database, no external frameworks, zero dependencies beyond the sure-\* packages.

```
┌───────────────────────────────────────────────────────────┐
│  sure-chatbot                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │ sure-    │  │ sure-    │  │ sure-ui          │        │
│  │ gentic   │  │ state    │  │ themes + toasts  │        │
│  │ Agent +  │  │ eventBus │  │                  │        │
│  │ Skills   │  │ store    │  │ 3 themes         │        │
│  │          │  │ pattern  │  │ notifications    │        │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘        │
│       │             │                 │                  │
│       ▼             ▼                 ▼                  │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Node.js HTTP Server (zero framework)             │   │
│  │  built-in http, fs, url modules                   │   │
│  └───────────────────────────────────────────────────┘   │
│           │                                              │
│           ▼                                              │
│  ┌───────────────────────────────────────────────────┐   │
│  │  HTML/CSS/JS Frontend (single file)               │   │
│  │  Chat UI + Settings + Themes                      │   │
│  │  ┌─────────────────────────────────────────┐      │   │
│  │  │ Cookie Store (sure-state createCookieStore)│     │   │
│  │  │ Preferences + chat history in cookies   │      │   │
│  │  │ Survives page reload, agent-inspectable │      │   │
│  │  └─────────────────────────────────────────┘      │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
│  ┌───────────────────────────────────────────────────┐   │
│  │  sure-web-testing (E2E tests)                     │   │
│  │  BrowserManager — launch, navigate, interact,     │   │
│  │  inspect DOM/console/network between every step   │   │
│  │  21 tests covering full chat UI flow              │   │
│  └───────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd sure-examples/chatbot
npm install
npm start                    # tsx server.js
# → http://localhost:3001

Open the browser. The chatbot starts in mock mode — no API key needed. Type a message, and the mock provider returns a canned response.

### Run E2E tests

```bash
python3 -m venv .venv
.venv/bin/pip install -e /path/to/sure-web-testing
.venv/bin/playwright install chromium
.venv/bin/python tests/run_tests.py    # 21 tests, all pass
```

Open the **Settings** drawer to:
- Switch to OpenAI or Anthropic (enter your API key)
- Change the model
- Adjust temperature
- Switch between Nord, Forest, and Dracula themes

## How it showcases each project

### sure-gentic — LLM Provider Abstraction

The server uses sure-gentic's `Agent` + `BaseSkill` pattern to make LLM calls. The provider is determined by environment variables set dynamically from the UI settings:

```js
import { Agent, BaseSkill } from 'sure-gentic'

// The agent auto-discovers the provider from env vars
const agent = new Agent()

// Skills encapsulate LLM-powered tasks
class ChatSkill extends BaseSkill {
  name = 'chat'
  description = 'Respond to user message'
  async execute(ctx) {
    return this.callLLM(this.agent, ctx.messages)
  }
}

// Run the skill — provider-agnostic
const result = await agent.run(new ChatSkill(), { messages })
```

Switching from OpenAI to Anthropic in the UI changes `AI_PROVIDER` and creates a new `Agent` — no code changes, no imports to swap. The same pattern works for testing with the `mock` provider.

**Key sure-gentic concepts demonstrated:**
- `Agent` — central orchestrator, auto-discovers provider from env
- `BaseSkill` — encapsulate a task with `name`, `description`, `execute()`
- `callLLM` — provider-agnostic LLM call
- Provider swap via `AI_PROVIDER` env var — no lock-in

### sure-state — In-Memory Store Pattern

The server uses sure-state's `createEventBus` to instrument state changes. The conversation store follows the entity store pattern — create conversations, add messages, track state:

```js
import { createEventBus } from 'sure-state'

const bus = createEventBus()

// Instrument every state change
bus.on('action', (record) => console.log('[store]', record.kind, record.detail))
bus.on('error', ({ message }) => console.error('[store] error:', message))

// State changes emit events
function addMessage(conversationId, role, content) {
  const message = { id: String(++id), role, content, timestamp: Date.now() }
  conv.messages.push(message)
  bus.emit('action', {
    kind: 'create', entityName: 'message', success: true,
    detail: `${role}: ${content.slice(0, 60)}...`,
  })
  return message
}
```

In a production app, this same pattern scales to `createEntityStore` from sure-state, with server-first sync and WebSocket push events. The event bus connects to Prometheus metrics (`createMetricsCollector`), OpenTelemetry spans (`attachOtelSpans`), and agent-inspectable MCP tools (`createAgentTools`).

**Key sure-state concepts demonstrated:**
- `createEventBus` — typed event emitter for state lifecycle
- Store event instrumentation (action tracking, error logging)
- Entity store pattern (conversations as entities, messages as sub-entities)
- Ready to scale to `createEntityStore` with server sync

### sure-state createCookieStore — Client-Side Persistence

The chatbot stores all user preferences and chat history in browser cookies using the same API pattern as sure-state's `createCookieStore`. Settings (theme, provider, model, temperature) and entire conversation histories survive page reload — no server-side database needed.

```js
// Inline cookie store — mirrors sure-state's createCookieStore API
const cookieStore = {
  prefix: 'sure_',
  get(key, defaults) {
    // Reads from document.cookie, falls back to defaults
  },
  set(key, value) {
    document.cookie = `${this.prefix + key}=${encodeURIComponent(value)}; path=/; max-age=${365 * 86400}`
  },
  getAll(defaults) {
    // Returns all prefixed cookies merged with defaults
  },
}

// Persist settings on every change
cookieStore.set('theme', 'dracula')
cookieStore.set('provider', 'google')
cookieStore.set('model', 'gemini-2.5-flash-lite')

// Persist entire conversation history as JSON
function saveConversations() {
  const payload = JSON.stringify({ list: conversations, messages: messagesCache })
  cookieStore.set('conversations', payload)
  // Auto-truncates if cookie exceeds ~3.5KB
}
```

**What gets persisted:**

| Cookie | Content | Size strategy |
|--------|---------|--------------|
| `sure_theme` | Current theme name | Single value |
| `sure_provider` | LLM provider selection | Single value |
| `sure_model` | Model override | Single value |
| `sure_temperature` | Temperature setting | Single value |
| `sure_baseUrl` | Custom API base URL | Single value |
| `sure_conversations` | Full conversation history (list + messages) | Auto-truncates at ~3.5KB — keeps last 3 convs, 10 msgs each |

**Agentic benefit:** Because state lives in cookies rather than server memory, every preference and conversation is trivially inspectable and modifiable by AI agents. An agent tool can read `document.cookie` or the `cookieStore.getAll()` output to understand the full application state — themes, provider config, and conversation history — without needing server-side MCP tools.

In a production app, replace the inline implementation with sure-state's `createCookieStore`:

```ts
import { createCookieStore, syncToCookie } from 'sure-state'

const prefs = createCookieStore({
  prefix: 'myapp_',
  defaults: { theme: 'nord', language: 'en' },
})
```

### sure-ui — Theme Injection

Themes are loaded dynamically from the server, which reads sure-ui's exported CSS strings:

```js
// Server endpoint: GET /api/theme?name=nord
import { nord, forest, dracula } from 'sure-ui'
const themes = { nord, forest, dracula }
res.end(themes[themeName])  // Returns raw CSS string
```

The frontend injects the theme as a `<style>` tag:

```js
const res = await fetch(`/api/theme?name=${name}`)
const css = await res.text()
const style = document.createElement('style')
style.textContent = css
document.head.appendChild(style)
```

The notification system follows sure-ui's pattern — `showNotification` with mode and level, though implemented in vanilla JS here for zero-dependency frontend. In a full app, use `import { showNotification, clearNotifications } from 'sure-ui'`.

**Key sure-ui concepts demonstrated:**
- Theme CSS strings — import and inject at runtime
- Three themes: Nord, Forest, Dracula
- Notification pattern (toast with auto-dismiss)
- CSS variable-driven theming

### sure-factor — Schema-Driven Generation (future)

Sure-factor could generate the settings form itself. The provider/model/temperature settings are a perfect match for sure-factor's form generation:

```yaml
# Hypothetical sure-factor type for the settings form
name: llm-config
description: LLM provider configuration
fields:
  - name: provider
    type: select
    options: [mock, openai, anthropic]
    validation: required
  - name: apiKey
    type: password
    validation: conditional (required when not mock)
  - name: model
    type: text
    hints: { placeholder: 'gpt-4o' }
  - name: temperature
    type: range
    validation: min:0, max:2, step:0.1
```

The generated output would include validation regexes, sanitization pipelines (trim API keys, escape model names), and sure-state store bindings — matching the three-tier (vibe, prototype, production) pattern.

### sure-web-testing — E2E Browser Testing

21 E2E tests run against the real chatbot using sure-web-testing's `BrowserManager`. The test script at `tests/test_chatbot.py` demonstrates multi-step browser testing:

```python
from browser import BrowserManager

mgr = BrowserManager()
mgr.launch(headless=True)
mgr.goto("http://localhost:3001")

# Interact step by step — browser stays alive between calls
mgr.fill("#messageInput", "Hello!")
mgr.click("#sendBtn")

# Inspect state between every action
dom = mgr.get_dom()
logs = mgr.get_console_logs()
screenshot = mgr.screenshot()

mgr.close()
```

The test suite covers 21 scenarios:

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `launch` | Browser session starts |
| 2 | `goto chatbot` | Page loads without error |
| 3 | `verify page load` | Title and URL are correct |
| 4 | `verify sidebar` | Sidebar header, settings button, chat input exist |
| 5 | `screenshot initial` | Base64 screenshot captured |
| 6 | `open settings` | Settings button click opens drawer |
| 7 | `verify settings` | Provider select, API key, model, temp, themes all present |
| 8 | `switch theme` | Dracula theme applies via click |
| 9 | `screenshot dracula` | Visual confirmation of theme change |
| 10 | `switch back to nord` | Theme switches back |
| 11 | `close settings` | Drawer closes |
| 12 | `send message` | Text fills and send button works |
| 13 | `verify response` | Assistant response appears in DOM |
| 14 | `screenshot with messages` | Chat with conversation captured |
| 15 | `console logs` | Browser console captured (no errors) |
| 16 | `network requests` | API calls logged |
| 17 | `clear messages` | Clear button works |
| 18 | `new conversation` | New conversation button works |
| 19 | `verify new conversation` | Clean state after new conversation |
| 20 | `screenshot final` | Final state captured |
| 21 | `close` | Browser session cleaned up |

Each step is a separate browser interaction — the session stays alive between calls, and you can inspect DOM, console, network, and screenshots between every step.

#### Run the tests

```bash
cd sure-examples/chatbot

# Set up Python env (one time)
python3 -m venv .venv
.venv/bin/pip install -e /path/to/sure-web-testing
.venv/bin/playwright install chromium

# Run tests (starts server, runs browser tests, cleans up)
.venv/bin/python tests/run_tests.py

# Or step by step:
npm start                    # terminal 1: start chatbot
.venv/bin/python tests/test_chatbot.py   # terminal 2: run tests
```

## Architecture

```
┌─────────────┐     HTTP/JSON      ┌──────────────────┐
│  Frontend   │ ◄──────────────►  │  Server           │
│  (vanilla   │                    │  (Node.js http)   │
│   HTML/CSS/ │  GET  /api/config  │                   │
│   JS)       │  POST /api/config  │  ┌─────────────┐  │
│             │  GET  /api/theme   │  │ sure-gentic  │  │
│  ┌───────┐  │  GET  /api/convos  │  │ Agent+Skill  │  │
│  │ Chat  │  │  POST /api/chat   │  └─────────────┘  │
│  │ UI    │  │  POST /api/convos  │                   │
│  └───────┘  │                    │  ┌─────────────┐  │
│  ┌───────┐  │                    │  │ sure-state   │  │
│  │Settings│  │                    │  │ EventBus    │  │
│  │ Drawer │  │                    │  └─────────────┘  │
│  └───────┘  │                    │                   │
│  ┌───────┐  │                    │  ┌─────────────┐  │
│  │Theme  │  │                    │  │ sure-ui      │  │
│  │Engine │  │                    │  │ Theme CSS    │  │
│  └───────┘  │                    │  └─────────────┘  │
└─────────────┘                    └──────────────────┘
```

## API Reference

### `GET /api/config`

Returns the current server config:

```json
{ "provider": "mock", "apiKey": "", "model": "", "temperature": 0.7, "theme": "nord" }
```

### `POST /api/config`

Update config. Accepts partial updates:

```json
{ "provider": "openai", "apiKey": "sk-..." }
```

### `GET /api/conversations`

List all conversations:

```json
[{ "id": "1743000000000", "title": "What is...", "messageCount": 4, "createdAt": 1743000000000, "lastMessageAt": 1743000100000 }]
```

### `POST /api/conversations`

Create a new conversation.

### `POST /api/chat`

Send a message and get a response:

```json
{ "conversationId": "1743000000000", "message": "Hello!" }

→ { "message": { "id": "1", "role": "assistant", "content": "Hi! How can I help?", "timestamp": 1743000100000 } }
```

### `GET /api/theme?name=nord`

Returns raw CSS for the named theme (`nord`, `forest`, `dracula`).

## File Structure

```
chatbot/
  README.md        ← this file (extensive documentation)
  package.json     ← depends on sure-gentic, sure-state, sure-ui
  server.js        ← Node.js HTTP server (zero external framework)
  public/
    index.html     ← single-file frontend (chat UI + settings + themes + cookie persistence)
  tests/
    run_tests.py   ← test runner (starts server, runs tests, cleans up)
    test_chatbot.py ← 21 E2E tests using sure-web-testing BrowserManager
```

## Extending

Ideas for extending the example:

| Feature | How | sure-* project |
|---------|-----|----------------|
| **Persist conversations** | Replace in-memory store with `createEntityStore` + API adapter | sure-state |
| **Streaming responses** | Add SSE endpoint, use sure-gentic's `completeStream()` | sure-gentic |
| **Agent tools** | Add `web_search` or `calculator` tools via sure-gentic's `ToolRegistryService` | sure-gentic |
| **MCP server** | Add `createAgentTools` + `createMcpServer` so OpenCode can inspect state | sure-state |
| **Audit logging** | Add `createMetricsCollector` + `attachOtelSpans` to the event bus | sure-state |
| **Form generation** | Generate the settings form with sure-factor from a type catalog | sure-factor |
| **E2E testing** | Test with sure-web-testing's MCP server + Playwright | sure-web-testing |
| **Notification themes** | Use sure-ui's `showNotification` with `sidePanel` mode for error history | sure-ui |
