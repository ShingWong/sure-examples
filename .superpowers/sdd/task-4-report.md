# Task 4: Tool Browser, MCP Manager, Skill Library Panel Modes

## Status: ✅ Complete

## Changes Made

### server.js
- **Import**: Added `ToolRegistryService` to the `sure-gentic` import
- **Route**: Added `GET /api/tools` endpoint that lists registered tools from `ToolRegistryService.getInstance().listTools()`, mapping each tool to `{ name, description, parameters }`

### public/index.html
- **Chat header**: Added a `<select id="panelModeSelect">` dropdown in the chat header toolbar with options: Settings, Tools, MCP Servers, Skills, Inspect. The dropdown calls `savePanelState({mode, title})` on change.
- **renderPanel() switch**: Added 3 new cases:
  - `'tools'` — fetches `/api/tools` and renders tool cards with name, description, and parameter list
  - `'mcp'` — renders MCP server configuration form (server name + command inputs, "Add Server" button with toast placeholder)
  - `'skills'` — renders static skill library showing `chat` and `generate_content` skills

## Acceptance Criteria Checklist

- [x] `GET /api/tools` endpoint returns registered tools from ToolRegistryService
- [x] Tools panel mode fetches and displays tools from `/api/tools`
- [x] MCP panel mode shows server configuration form
- [x] Skills panel mode shows available BaseSkill implementations
- [x] Mode selector dropdown added to chat header

## Files Modified
- `chatbot/server.js` — import + route
- `chatbot/public/index.html` — mode selector + 3 panel renderers

## Notes
- MCP "Add Server" button shows a toast: "MCP server management coming in persona-bot"
- Mode selection syncs to panel state via `savePanelState()`, which persists to the server and re-renders the panel
- `git commit` pending — run: `cd /usr/local/devel/sure-examples && git add -A && git commit -m "feat: tool browser, MCP manager, skill library panel modes"`
