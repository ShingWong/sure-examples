# sure-examples

Working software beats slide decks. This repo is where the **sure stack** stops being a set of libraries and starts being real applications — each example wires several sure-* projects together so you can see how they compose, copy the patterns, and ship faster.

**The pitch:** stop gluing together a form library, a state manager, a theme, an LLM SDK, and a test harness that were never designed to meet. The sure stack is a family of small, dependency-light TypeScript libraries with one shared philosophy — *plain data in, plain output out, no lock-in anywhere*. Swap LLM providers with an env var. Swap themes with an import. Inspect every state transition. Drive a real browser from your agent. And when you need UI fast, generate it straight from your database schema.

| Example | Description | Showcases |
|---------|-------------|-----------|
| [chatbot](./chatbot/) | Lightweight in-memory chatbot with configurable LLM provider, API keys, models, and themes. 26 E2E browser tests included. | sure-gentic, sure-state, sure-ui, sure-web-testing |
| [components](./components/) | **Start here if you are new.** Write a database table, get a working validated form. No HTML written by hand. | sure-factor, sure-ui |

## Meet the stack

### [sure-gentic](https://github.com/ShingWong/sure-gentic) — AI agents without the lock-in

Build AI agents from three simple ideas — **Agents**, **Skills**, and **Tools** — then run them against OpenAI, Anthropic, Google, OpenRouter, or any OpenAI-compatible endpoint. Switching models is an environment variable, not a rewrite. A bounded tool loop with allowlists and citations keeps agents useful *and* auditable.

*In the chatbot:* the entire conversation engine is one `Agent` + `runToolLoop`. Pick a provider in the settings dialog, and the same code path serves GPT-4o, Claude, Gemini, a local llama.cpp server — or the keyless `mock` provider, which even demonstrates tool calls on its own.

### [sure-state](https://github.com/ShingWong/sure-state) — state you can see into

The server is always the source of truth: entity stores with typed CRUD, real-time push, and an inspector that records every action with timing and snapshots. No silent cache drift, no mystery mutations — agent-inspectable by design.

*In the chatbot:* conversations ride the entity-store pattern while an event bus logs every message lifecycle event. Scale up by pointing the same store at a real API adapter — the pattern doesn't change.

### [sure-ui](https://github.com/ShingWong/sure-ui) — instant good taste

Three cohesive themes (Nord, Forest, Dracula) injected as plain CSS strings at runtime — no bundler config, no framework, no rebuild to re-skin. Plus a unified notification system (inline, toast, status bar, side panel) and accessibility baked in, not bolted on.

*In the chatbot:* the theme switcher in the settings dialog is literally one import swap. Toasts, dialogs, and the message layout all speak the same `sure-*` class language.

### [sure-factor](https://github.com/ShingWong/sure-factor) — from schema to UI in one step

Point sure-factor at a SQL schema and get production-grade form UIs — validated, sanitized, and internationalized from day one, at three quality tiers from weekend vibe to audited production. Fifteen built-in types (email, phone, ICD-10, SSN…) carry their own regex, pipelines, and translations.

*In the chatbot:* not wired in yet — it's the newest sibling. Imagine the settings and key-management forms generated from a schema instead of hand-written. The [components example](./components/) is that roadmap, working: a form generated from a schema by sure-factor.

### [sure-web-testing](https://github.com/ShingWong/sure-web-testing) — a browser your agent can drive

A persistent Playwright session behind an MCP server: launch once, then navigate, inspect DOM, capture console and network logs, screenshot, and even record video — step by step, state preserved between calls. Vision analysis swaps providers with one env var, and any MCP-aware agent can take the wheel.

*In the chatbot:* the 21-step E2E suite (`chatbot/tests/`) boots the real server, signs in, switches themes, chats, and screenshots — all through this library. It's both the test harness and a demo of agentic browser control.

## Projects at a glance

| Project | Role |
|---------|------|
| [sure-factor](https://github.com/ShingWong/sure-factor) | Schema-driven code generation |
| [sure-state](https://github.com/ShingWong/sure-state) | Client-server state synchronization |
| [sure-ui](https://github.com/ShingWong/sure-ui) | Theme CSS + notification runtime |
| [sure-gentic](https://github.com/ShingWong/sure-gentic) | Portable agent creation framework |
| [sure-web-testing](https://github.com/ShingWong/sure-web-testing) | Browser testing via MCP server |
