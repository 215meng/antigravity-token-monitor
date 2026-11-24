# Antigravity Token Monitor (Enhanced & Exact Accounting Edition)

**English** | [简体中文](docs/README.zh-CN.md)

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Real-time, deduplicated, and accurate Antigravity session token & cost monitoring — **natively inside Antigravity** (left sidebar global dashboard, right auxiliary pane monthly/daily KPIs, and in-chat queries) as well as VS Code.

> [!NOTE]
> **Upstream Attribution**
> This fork builds upon **[ddarkr/antigravity-token-monitor](https://github.com/ddarkr/antigravity-token-monitor)** (MIT License) with deep bug fixes, Windows support, exact cross-session deduplication, per-day per-model cost accounting, and Simplified Chinese UI localization. All original copyright notices are preserved with respect to the upstream author.

![Dashboard Preview](docs/screenshot.png)

---

## Core Enhancements in This Fork

Building on the upstream architecture, this edition resolves critical inaccuracies in token acquisition, duplicate counting, daily attribution, and model pricing:

- 🎯 **End-to-End Exact Deduplication (Zero Double-Counting, Zero Omissions)**
  - Prioritizes the authoritative `raw.chatModel.usage` payload, ignoring legacy doubled top-level cache fields and duplicate `retryInfos` mirrors for the same request.
  - Splits `outputTokens` orthogonally into pure response output (`responseOutputTokens`) and reasoning tokens (`thinkingOutputTokens`) so reasoning tokens are never counted twice.
  - Skips fallback `steps.jsonl` usage payloads whenever authoritative `usage.jsonl` records are present.
  - Arbitrates cross-session ownership by unique request ID (`responseId` / `messageId`), eliminating multi-fold inflation from cloned history between parent sessions and subagents/forks.
  - Automatically fuses real `PLANNER_RESPONSE` calls from `transcript.jsonl` on reverted or edited branches that would otherwise be overwritten.
- 📅 **True Daily Activity Heatmap & Per-Model Cost Calculation**
  - Resolves per-step timestamps from SQLite `steps` tables, exported `stepIndices`, and `transcript.jsonl` `created_at` fields to attribute every model call to the exact local calendar date (`YYYY-MM-DD`) on which it occurred.
  - Computes each day's estimated cost (`costUsd`) strictly from that day's actual per-model token breakdown (`input` / `output` / `reasoning` / `cacheRead` / `cacheWrite`) rather than spreading a global historical average across days.
- 🗄️ **Native SQLite `.db` Reading & 50MB Large-File Support**
  - Adds `sqliteTrajectoryReader` to read `steps` and `gen_metadata` directly from `conversations/<sessionId>.db` when RPC summaries are unavailable or offline.
  - Raises the default `maxFileBytes` limit to `52428800` (50 MB) to prevent large long-running sessions from being truncated, while retaining both active and monthly-archived sessions.
- 🔄 **Automatic Real-Time Incremental Sync**
  - Combines scheduled polling with debounced file watchers on `conversations/` and `brain/` so new sessions and updates sync automatically without manual intervention.
- 🪟 **Windows Support & Modern Model Pricing**
  - Fixes Windows process/port detection and case-insensitive path matching.
  - Supports placeholder resolution, alias canonicalization, and LiteLLM official pricing lookups for the Gemini 4 family (Neon, Carbon, Argon, Hydrogen), multi-model Orchestrator (Neon / Carbon / Argon / Claude Opus 5.5), Gemini 3.8 Flash, Claude Opus/Sonnet 5.5 & 4.6, GPT-OSS 120B, and more.
- 🌐 **Simplified Chinese UI**
  - Full Simplified Chinese localization across the webview dashboard, Activity Bar sidebar, status bar tooltips, and extension settings.

---

## ⚠️ Disclaimer

> [!WARNING]
>
> - This is an unofficial community open-source tool and is not affiliated with Google.
> - It relies on Antigravity's local persisted files and internal `127.0.0.1` RPC endpoints, whose schemas may change across software updates.
> - Cost estimates are calculated using the open-source [LiteLLM pricing catalog](https://github.com/BerriAI/litellm) and built-in fallbacks for reference only—do not use them for billing reconciliation.
> - All session scanning, parsing, and analytics run locally on your machine; no conversation content or private data is ever uploaded (the only external network request fetches the public LiteLLM pricing JSON from GitHub).

---

## Getting Started (Antigravity Native Plugin — Recommended)

### Prerequisites

- [Antigravity](https://antigravity.google/) running locally or saved sessions under `~/.gemini/antigravity`
- [Node.js](https://nodejs.org/) `≥ 22` (provides built-in `node:sqlite` for direct `.db` reading; Node 20+ automatically falls back to RPC/filesystem parsing)

### 3-Step Build & Install from Source

```bash
# 1. Clone and install dependencies
git clone https://github.com/215meng/antigravity-token-monitor.git
cd antigravity-token-monitor
npm install

# 2. Build the Antigravity MCP App plugin bundle (single-file HTML + stdio MCP server)
npm run build:plugin

# 3. Install into ~/.gemini/config/plugins/antigravity-token-monitor/
npm run install:plugin
```

> [!TIP]
> If you previously installed a standalone skill at `~/.gemini/config/skills/token-monitor/`, you can delete that old folder after installing the plugin to avoid duplicate skill triggers—the skill is now bundled directly inside the plugin.

### Usage in Antigravity

1. **Global Full-Page Dashboard**: Click **Token Monitor** in the Antigravity left sidebar for the complete KPI strip (including **This Month Cumulative** & **Today**), daily activity heatmap, model usage breakdown, LiteLLM cost estimate, and session leaderboard.
2. **Auxiliary Side Pane**: Open **Token 用量** from the side pane `+` menu (or ask the agent to open the sidebar) for a persistent compact view highlighting **Monthly Cumulative** and **Today's Usage**.
3. **In-Chat Queries**: Ask `"How many tokens did I use this month?"` or `"今天用了多少 token"`—the bundled `token-monitor` skill automatically invokes `get_token_usage_summary`.

---

## VS Code Extension (Maintenance Mode)

The original VS Code extension shares the same core engine and Svelte 5 components. To build and install the `.vsix` package:

```bash
# Run type checks, unit tests, and package VSIX
npm run typecheck
npm run typecheck:webview
npm run test:webview
npm run package
```

On Windows, you can run the one-click installer script at the repository root:

```powershell
.\install-extension.ps1
```

Alternatively, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) in VS Code and run `Extensions: Install from VSIX...`, then select the generated `.vsix` file.

---

## Architecture

```
Core (Types/Config/Summary) → Storage → Data Acquisition → Analysis → Orchestration → Presentation (MCP App / VS Code)
```

- `src/core/` — Host-agnostic configuration, minimal logger/disposable interfaces, and unified period usage summaries (`today` / `month` / `all`)
- `src/mcp/` — Antigravity MCP App stdio server (`SEP-1865` + `com.google.antigravity/ui`), env-var direct RPC locator, and tool handlers
- `src/rpc/` — Process detection, localhost HTTP/HTTPS RPC client, native SQLite `.db` reader, and incremental JSONL exporter
- `src/parser/` — Canonical token extraction and per-step daily model breakdown attribution
- `src/monitor/` — Session scanning, cross-session `responseId` deduplication, reverted-branch fusion, polling orchestration, and file locks
- `src/pricing/` — LiteLLM catalog fetching, alias matching, and per-model cost calculation
- `src/storage/` — Local RPC artifact cache and monthly-sharded session state persistence
- `src/statusBar/` & `src/webview/` — Svelte 5 dashboard/sidebar UI with dual-mode `HostBridge` & `ThemeBridge` (Antigravity MCP App + VS Code Webview)
- `plugin-template/` — Desensitized Antigravity plugin manifest, `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` MCP config, logo, and bundled skill

---

## Inspired By

- **[ddarkr/antigravity-token-monitor](https://github.com/ddarkr/antigravity-token-monitor)** — Upstream project and original author
- **[antigravity-storage-manager](https://github.com/unchase/antigravity-storage-manager)** — Session token parsing reference
- **[tokscale](https://github.com/junhoyeo/tokscale)** — Usage tracking and visualization inspiration

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
