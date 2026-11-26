# sure-chatbot

**A lightweight in-memory chatbot showcasing the sure-\* ecosystem.** Configure LLM provider, API key, model, temperature, and theme — all from the UI. No database, no external frameworks. The settings and key forms are generated from SQL by sure-factor and rendered with plain DOM calls; the only build-time extra is esbuild, which strips types from the generated module.

```
┌───────────────────────────────────────────────────────────┐
│  sure-chatbot                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │ sure-    │  │ sure-    │  │ sure-ui          │        │
│  │ gentic   │  │ state    │  │ themes + toasts  │        │
│  │ Agent +  │  │ eventBus │  │                  │        │
│  │ Skills   │  │ store    │  │ 4 themes         │        │
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
│  │  26 tests covering full chat UI flow              │   │
│  └───────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd sure-examples/chatbot
npm run setup              # install, build the file: linked sure-* deps, generate forms
npm start                    # tsx server.js
# → http://localhost:3001
```

Open the browser. The chatbot starts in mock mode — no API key needed. Type a message, and the mock provider returns a canned response.

### Run E2E tests

```bash
python3 -m venv .venv
.venv/bin/pip install -e /path/to/sure-web-testing
.venv/bin/playwright install chromium
.venv/bin/python tests/run_tests.py    # 26 tests, all pass
```

The runner stops stale chatbot servers on port 3001 before starting
(`tests/chatbot_cleanup.py`), so leftover manual `tsx server.js`
processes no longer mask the current build.

Open the **Settings** modal (⚙ in the header menu) to:
- Switch to OpenAI or Anthropic (enter your API key)
- Change the model
- Adjust temperature
- Switch between Nord, Forest, Dracula, and Dark themes

The provider, model, temperature and base-URL fields in that dialog — and the
provider / base-URL / API-key fields in the 🔑 Keys dialog — are generated from
`schema.sql`. The app supplies plain values and callbacks to the generated DOM
renderer; it does not write those fields by hand. Theme swatches and the model
browser button are app chrome around the generated form.

Open the **🔧 Tools** dialog to:
- Enable/disable tools (`web_search`, `calculator`, `current_time`, `firesearch_*`) — persisted server-side in `.tools.json`
- See whether `web_search` is live or returning mock results, and whether `firesearch_search` is connected

Tools fire on `openai`, `openai-compatible`, and `openrouter` providers —
`mock` demonstrates the loop with heuristic tool calls (no API key).
Anthropic / Google ignore tool schemas. Live web search needs a SerpAPI
or Exa key: add it in the **🔑 Keys** dialog (stored encrypted, verified before
saving). The `firesearch_*` tools need a Firesearch instance: add a
**Firesearch** key with its instance host as Base URL (secret key stays
server-side, never sent to the browser).

Attach images and files (PDF, text, CSV…) with the 📎 button: images get a
thumbnail preview and render inline in your message; files ride along as
message parts. Backend mapping is per-provider (images/PDFs native on
OpenAI, Anthropic, and Google; spreadsheets/Word docs are noted as
unsupported by most chat APIs). Attachments are capped at 3MB.

## How it showcases each project

### sure-gentic — LLM Provider Abstraction

The server uses sure-gentic's `Agent` + `BaseSkill` pattern to make LLM calls. The provider is determined by environment variables set dynamically from the UI settings:

```js
import { Agent } from 'sure-gentic'

// The agent auto-discovers the provider from env vars
const agent = new Agent()

// Agentic loop — model may call registered tools (web_search,
// calculator, current_time); no-tool turns behave like single-shot
const result = await agent.runToolLoop(
  [{ role: 'system', content: 'You are a helpful assistant.' }, ...messages],
  { maxRounds: 5 },
)
// → { success: true, data: '...', toolsUsed: ['calculator'] }
```

Switching from OpenAI to Anthropic in the UI changes `AI_PROVIDER` and creates a new `Agent` — no code changes, no imports to swap. The same pattern works for testing with the `mock` provider.

**Key sure-gentic concepts demonstrated:**
- `Agent` — central orchestrator, auto-discovers provider from env
- `runToolLoop` — bounded agentic loop (tools + `toolsUsed` for citation)
- `BaseSkill` — encapsulate a task with `name`, `description`, `execute()` (used for content generation)
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
import { nord, forest, dracula, dark } from 'sure-ui'   // local alias in this example
const themes = { nord, forest, dracula, dark }
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
- Four themes: Nord, Forest, Dracula, Dark (sure-ui itself ships seven)
- Notification pattern (toast with auto-dismiss)
- CSS variable-driven theming

### sure-factor — Schema-Driven Generation

`schema.sql` declares the two forms the chatbot needs: `chatbot_settings` and
`provider_key`. `scripts/generate.mjs` reads it with sure-factor and writes
`public/generated/form.js` — a framework-free DOM renderer plus the field list
it was generated for. The browser imports that module, filters the generated
fields by source table, and passes plain values and callbacks:

```js
const form = generatedForms.renderForm(
  { id: 'chatbot-settings', title: 'LLM configuration', fields: SETTINGS_FIELDS() },
  {
    values: { provider, model, temperature, base_url },
    onChange: onConfigChange,
    onSubmit: saveConfig,
  },
)
```

`temperature` is declared `NUMERIC(3,2)` in the SQL; the adapter turns the
generated number input into a 0–2 range slider. The `CHECK (... IN (...))`
constraints become provider selects, and the `key_password` column becomes a
password input. Labels, help text, validation, sanitisers and `sure-form__*`
CSS classes all come from sure-factor's catalog — the app only wires them to
the existing cookie-backed config and key APIs. Re-run `npm run generate`
after changing the schema; the generated files are checked in so the E2E suite
needs no build step.

### sure-web-testing — E2E Browser Testing

26 E2E tests run against the real chatbot using sure-web-testing's `BrowserManager`. The test script at `tests/test_chatbot.py` demonstrates multi-step browser testing:

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

The suite has 26 steps:

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `launch` | Browser session starts |
| 2 | `goto chatbot` | Page loads without error |
| 3 | `verify login page` | Login form is rendered |
| 4 | `screenshot login` | Login screenshot captured |
| 5 | `sign in` | Demo credentials open the chat UI |
| 6 | `verify page load` | Title and URL are correct |
| 7 | `verify sidebar` | Sidebar heading, settings button, chat input exist |
| 8 | `screenshot initial` | Base64 screenshot captured |
| 9 | `open settings` | Header menu opens the Settings modal |
| 10 | `verify settings` | Generated provider, model and temperature controls plus four themes |
| 11 | `switch theme` | Dracula theme applies via click |
| 12 | `screenshot dracula` | Visual confirmation of theme change |
| 13 | `switch back to nord` | Theme switches back |
| 14 | `close settings` | Modal closes |
| 15 | `send message` | Text fills and send button works |
| 16 | `verify response` | Assistant response appears in DOM |
| 17 | `screenshot with messages` | Chat with conversation captured |
| 18 | `console logs` | Browser console captured |
| 19 | `network requests` | API calls logged |
| 20 | `clear messages` | Clear button works |
| 21 | `new conversation` | New conversation button works |
| 22 | `verify new conversation` | Clean state after new conversation |
| 23 | `preview panel` | Right-hand preview panel opens and renders |
| 24 | `key management` | Generated API Keys form opens |
| 25 | `screenshot final` | Final state captured |
| 26 | `close` | Browser session cleaned up |

Each step asserts against the live DOM — element text, attributes, or the
CSS the app actually injected. Assertions are scoped to a specific element
rather than the whole page, because `page.content()` includes inline
`<script>` source (83% of this page), so a whole-page substring check can
pass by matching a JavaScript string literal instead of anything visible.

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
│  │ Modal  │  │                    │  └─────────────┘  │
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

Returns raw CSS for one of the four exposed themes (`nord`, `forest`, `dracula`, `dark`).

### `GET /api/tools`

Lists registered tools with UI state:

```json
[{ "name": "web_search", "description": "...", "parameters": [...], "enabled": true, "live": false }]
```

`live` (on `web_search` and `firesearch_search`) reports whether a search key
is configured — `web_search` needs a SerpAPI or Exa key (mock results without
one), `firesearch_search` needs a Firesearch host plus key.

### `POST /api/tools`

Enable/disable tools (unknown names are rejected):

```json
{ "enabled": { "web_search": false } }

→ { "ok": true, "tools": [...] }
```

## File Structure

```
chatbot/
  README.md        ← this file (extensive documentation)
  package.json     ← depends on sure-factor, sure-gentic, sure-state, sure-ui
  schema.sql       ← DDL for the settings and key forms
  scripts/
    generate.mjs   ← sure-factor → public/generated/form.js (run `npm run generate`)
  server.js        ← Node.js HTTP server (zero external framework)
  public/
    index.html     ← single-file frontend (chat UI + generated settings + themes + cookies)
    generated/
      form.js      ← committed, dependency-free DOM renderer generated from schema.sql
      fields.json  ← the same field specs as plain data, for inspection
  tests/
    run_tests.py   ← test runner (starts server, runs tests, cleans up)
    test_chatbot.py ← 26 E2E tests using sure-web-testing BrowserManager
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
| **E2E testing** | Test with sure-web-testing's MCP server + Playwright | sure-web-testing |
| **Notification themes** | Use sure-ui's `showNotification` with `sidePanel` mode for error history | sure-ui |
