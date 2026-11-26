# sure-examples

Working software beats slide decks. This repo is where the **sure stack** stops being a set of libraries and starts being real applications — each example wires several sure-* projects together so you can see how they compose, copy the patterns, and ship faster.

For the full ten-project ecosystem map, see `sure-master/docs/SURE-STACK-OVERVIEW.md` in the private planning repo. The five projects described below are the ones these examples actually use.

**The pitch:** stop gluing together a form library, a state manager, a theme, an LLM SDK, and a test harness that were never designed to meet. The sure stack is a family of small, dependency-light TypeScript libraries with one shared philosophy — *plain data in, plain output out, no lock-in anywhere*. Swap LLM providers with an env var. Swap themes with an import. Inspect every state transition. Drive a real browser from your agent. And when you need UI fast, generate it straight from your database schema.

| Example | Description | Showcases |
|---------|-------------|-----------|
| [components](./components/) | **Start here if you are new.** Write a database table, get a working validated form. No HTML written by hand. | sure-factor, sure-ui |
| [grouped-form](./grouped-form/) | Schema-defined sections, aligned grid — reduce cognitive load on long forms with two CSS variables. | sure-factor, sure-ui |
| [chatbot](./chatbot/) | Lightweight in-memory chatbot with configurable LLM provider, API keys, models, and themes. A 26-step E2E browser suite included. | sure-factor, sure-gentic, sure-state, sure-ui, sure-web-testing |

## Meet the stack

### [sure-gentic](https://github.com/ShingWong/sure-gentic) — AI agents without the lock-in

Build AI agents from three simple ideas — **Agents**, **Skills**, and **Tools** — then run them against OpenAI, Anthropic, Google, OpenRouter, or any OpenAI-compatible endpoint. Switching models is an environment variable, not a rewrite. A bounded tool loop with allowlists and citations keeps agents useful *and* auditable.

*In the chatbot:* the entire conversation engine is one `Agent` + `runToolLoop`. Pick a provider in the settings dialog, and the same code path serves GPT-4o, Claude, Gemini, a local llama.cpp server — or the keyless `mock` provider, which even demonstrates tool calls on its own.

### [sure-state](https://github.com/ShingWong/sure-state) — state you can see into

The server is always the source of truth: entity stores with typed CRUD, real-time push, and an inspector that records every action with timing and snapshots. No silent cache drift, no mystery mutations — agent-inspectable by design.

*In the chatbot:* conversations ride the entity-store pattern while an event bus logs every message lifecycle event. Scale up by pointing the same store at a real API adapter — the pattern doesn't change.

### [sure-ui](https://github.com/ShingWong/sure-ui) — instant good taste

Seven cohesive themes (Nord, Forest, Dracula, Dark, Positronic, vision-system, vision-atkinson) injected as plain CSS strings at runtime — no bundler config, no framework, no rebuild to re-skin. Plus a unified notification system (inline, toast, status bar, side panel), `SURE_TYPOGRAPHY` print metrics, and accessibility baked in, not bolted on.

*In the chatbot:* the theme switcher in the settings dialog is literally one import swap. Toasts, dialogs, and the message layout all speak the same `sure-*` class language.

### [sure-factor](https://github.com/ShingWong/sure-factor) — from schema to UI in one step

Point sure-factor at a SQL schema and get production-grade form UIs — validated, sanitized, and internationalized from day one, at three quality tiers from weekend vibe to audited production. Fifteen built-in types (email, phone, ICD-10, SSN…) carry their own regex, pipelines, and translations.

*In the chatbot:* the settings and key-management forms are generated from `chatbot/schema.sql` by sure-factor and drawn with plain DOM calls — no hand-written fields, no React. The [components](./components/) and [grouped-form](./grouped-form/) examples remain the simplest starting point.

### [sure-web-testing](https://github.com/ShingWong/sure-web-testing) — a browser your agent can drive

A persistent Playwright session behind an MCP server: launch once, then navigate, inspect DOM, capture console and network logs, screenshot, and even record video — step by step, state preserved between calls. Vision analysis swaps providers with one env var, and any MCP-aware agent can take the wheel.

*In the chatbot:* the 26-step E2E suite (`chatbot/tests/`) boots the real server, signs in, switches themes, chats, and screenshots — all through this library. It's both the test harness and a demo of agentic browser control.

## Projects at a glance

The whole ecosystem (the first five are the ones showcased here):

| Project | Role | Used here |
|---------|------|-----------|
| [sure-factor](https://github.com/ShingWong/sure-factor) | Schema-driven code generation | components, grouped-form, chatbot |
| [sure-state](https://github.com/ShingWong/sure-state) | Client-server state synchronization | chatbot |
| [sure-ui](https://github.com/ShingWong/sure-ui) | Theme CSS + notification runtime | all three |
| [sure-gentic](https://github.com/ShingWong/sure-gentic) | Portable agent creation framework | chatbot |
| [sure-web-testing](https://github.com/ShingWong/sure-web-testing) | Browser testing via MCP server | chatbot E2E suite |
| [sure-core](https://github.com/ShingWong/sure-core) | Bounded MIME/RFC 5322 parsing primitives (Rust) | — |
| [sure-store](https://github.com/ShingWong/sure-store) | Storage contract + shared UI component catalog | — |
| [sure-document](https://github.com/ShingWong/sure-document) | Print-ready multi-sheet layout projection | — |
| [sure-mail](https://github.com/ShingWong/sure-mail-private) | Local-first mail client, headless WASM core | — |
| [sure-examples](https://github.com/ShingWong/sure-examples) | This repo — working compositions | — |
