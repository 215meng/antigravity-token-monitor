# Antigravity Token Monitor (Enhanced & Exact Accounting Edition)

**English** | [简体中文](docs/README.zh-CN.md)

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Real-time, deduplicated, and accurate Antigravity session token & cost monitoring right inside your VS Code dashboard, sidebar, and status bar.

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

## Getting Started

### Prerequisites

- [VS Code](https://code.visualstudio.com/) `≥ 1.96.0`
- [Node.js](https://nodejs.org/) `≥ 22` (provides built-in `node:sqlite` for direct `.db` reading; older versions automatically fall back to RPC/filesystem parsing)
- Antigravity running locally or existing saved sessions under `~/.gemini/antigravity`

### Build & Install from Source

```bash
# Clone the repository
git clone https://github.com/215meng/antigravity-token-monitor.git
cd antigravity-token-monitor

# Install dependencies
npm install

# Run type checks and unit tests
npm run typecheck
npm run typecheck:webview
npm run test:webview

# Optional: verify live local token consumption in the terminal
npm run usage

# Compile and package the VSIX extension
npm run package
```

On Windows, you can run the one-click installer script at the repository root:

```powershell
.\install-extension.ps1
```

Alternatively, open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`) in VS Code and run `Extensions: Install from VSIX...`, then select the generated `.vsix` file.

### Usage

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`).
2. Run `Antigravity Token 监控: 打开监控面板` (Open Dashboard).
3. You can also click the token counter in the right side of the status bar, or click the Activity Bar graph icon for the sidebar mini-dashboard.

---

## Architecture

```
Data Acquisition → Analysis → Orchestration → Presentation
```

- `src/rpc/` — Process detection, localhost HTTPS RPC client, native SQLite `.db` reader, and incremental JSONL exporter
- `src/parser/` — Canonical token extraction and per-step daily model breakdown attribution
- `src/monitor/` — Session scanning, cross-session `responseId` deduplication, reverted-branch fusion, polling orchestration, and file locks
- `src/pricing/` — LiteLLM catalog fetching, alias matching, and per-model cost calculation
- `src/storage/` — Local RPC artifact cache and monthly-sharded session state persistence
- `src/statusBar/` & `src/webview/` — VS Code status bar item and Svelte 5 dashboard / Activity Bar sidebar UI

---

## Inspired By

- **[ddarkr/antigravity-token-monitor](https://github.com/ddarkr/antigravity-token-monitor)** — Upstream project and original author
- **[antigravity-storage-manager](https://github.com/unchase/antigravity-storage-manager)** — Session token parsing reference
- **[tokscale](https://github.com/junhoyeo/tokscale)** — Usage tracking and visualization inspiration

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
