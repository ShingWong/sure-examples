# sure-chatbot

**A lightweight in-memory chatbot showcasing the sure-\* ecosystem.** Configure LLM provider, API key, model, temperature, and theme — all from the UI. No database, no external frameworks, zero dependencies beyond the sure-\* packages.

```
┌─────────────────────────────────────────────────────┐
│  sure-chatbot                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ sure-    │  │ sure-    │  │ sure-ui          │  │
│  │ gentic   │  │ state    │  │ themes + toasts  │  │
│  │ Agent +  │  │ eventBus │  │                  │  │
│  │ Skills   │  │ store    │  │ 3 themes         │  │
│  │          │  │ pattern  │  │ notifications    │  │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
│       │             │                 │            │
│       ▼             ▼                 ▼            │
│  ┌─────────────────────────────────────────────┐   │
│  │  Node.js HTTP Server (zero framework)       │   │
│  │  built-in http, fs, url modules             │   │
│  └─────────────────────────────────────────────┘   │
│           │                                        │
│           ▼                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │  HTML/CSS/JS Frontend (single file)         │   │
│  │  Chat interface + settings drawer + themes  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Quick Start

```bash
cd sure-examples/chatbot
npm install
node server.js
# → http://localhost:3001
```

Open the browser. The chatbot starts in mock mode — no API key needed. Type a message, and the mock provider returns a canned response.

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

### sure-web-testing — Browser Testing (future)

The chatbot's chat flow and settings interaction can be tested step-by-step using sure-web-testing's MCP server:

```
launch(headless=true)
goto("http://localhost:3001")
click("button:has-text('Settings')")
fill("input#apiKey", "sk-test-123")
selectOption("select#provider", "openai")
click("button:has-text('Send')")
screenshot(highlight="#messages .message:last-child")
get_console_logs()
close()
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
    index.html     ← single-file frontend (chat UI + settings + themes)
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
