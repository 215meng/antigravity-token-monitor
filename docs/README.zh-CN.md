# Antigravity Token Monitor (增强与精确核算版)

[English](../README.md) | **简体中文**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 无需频繁切换 VS Code！直接在 **Antigravity 原生界面**（左侧全局全页大屏、右侧辅助栏本月/今日用量面板、对话内实时查询）及 VS Code 中精准收集、去重、核算并可视化您的 Antigravity 会话 Token 使用量。

> [!NOTE]
> **致谢与项目声明（Upstream Attribution）**
> 本项目基于原作者 **ddarkr** 的开源项目 **[ddarkr/antigravity-token-monitor](https://github.com/ddarkr/antigravity-token-monitor)**（MIT License）进行深度修复、Windows 适配、全量中文汉化与精确核算增强二次开发。完整保留原作者版权声明，并向原作者致敬！

![Dashboard Preview](screenshot.png)

---

## 本 Fork 版本核心改进与新增特性

在原项目架构的基础上，本版本重点修复了底层采集、重复统计、跨日核算与模型定价等核心问题：

- 🎯 **全链路精确去重核算（零重复、零遗漏）**
  - 优先提取权威 `raw.chatModel.usage` 字段，屏蔽旧缓存顶层翻倍脏数据及同请求镜像 `retryInfos`；
  - 将 `outputTokens` 正交拆分为纯答复输出（`responseOutputTokens`）与深度思考（`thinkingOutputTokens`），避免重复累加；
  - 当 `usage.jsonl` 存在时不重复累加 `steps.jsonl` 中的回退用量；
  - 通过唯一请求 ID（`responseId` / `messageId`）执行跨会话所有权仲裁，彻底消除主会话与 Subagent/Fork 子会话之间因历史克隆导致的数倍虚高；
  - 自动融合 `transcript.jsonl` 中因修改重发/回退分支（Revert/Edit）而被覆盖掉的历史真实 `PLANNER_RESPONSE` 调用。
- 📅 **真实每日热力图与逐日分模型精准计费**
  - 通过解析 SQLite `steps` 表时间戳、导出 `stepIndices` 与 `transcript.jsonl` `created_at`，将每一次模型调用归入其实际发生的本地日期（`YYYY-MM-DD`），杜绝跨日长会话因新对话将过去日期的用量迁走；
  - 按当日各模型的真实 `input` / `output` / `reasoning` / `cacheRead` / `cacheWrite` 构成逐项核算每日预估费用（`costUsd`），告别全历史均价分摊偏差。
- 🗄️ **本地 SQLite `.db` 原生直读与 50MB 大文件支持**
  - 新增 `sqliteTrajectoryReader`，在 RPC 摘要缺失或离线情况下直接从 `conversations/<sessionId>.db` 读取 `steps` 与 `gen_metadata`；
  - 默认 `maxFileBytes` 提升至 `52428800`（50MB），防止大型长会话被截断；完整纳入活跃与归档会话。
- 🔄 **全自动增量实时同步**
  - 通过定时增量刷新 + `conversations/`、`brain/` 目录文件监听（防抖自动导出与重算），无需手动干预即可自动同步最新真实用量。
- 🪟 **Windows 深度适配与新模型支持**
  - 修复 Windows 下的进程/端口探测与大小写路径包含判定；
  - 支持最新模型家族解析、官方前缀匹配与定价映射（Gemini 4 Neon / Carbon / Argon / Hydrogen、多模型 Orchestrator (Neon / Carbon / Argon / Claude Opus 5.5)、Gemini 3.8 Flash 全档位、Claude Opus/Sonnet 5.5 & 4.6、GPT-OSS 120B 等）。
- 🇨🇳 **完整简体中文汉化**
  - 看板、侧边栏、状态栏、热力图悬浮提示与配置说明全面简体中文化。

---

## ⚠️ Disclaimer / 免责声明

> [!WARNING]
>
> - 本项目为非官方社区开源工具，与 Google 无任何关联。
> - 依赖 Antigravity 本地持久化数据与内部 `127.0.0.1` RPC 接口，接口格式可能随软件版本变化。
> - 成本估算基于 [LiteLLM 开源定价表](https://github.com/BerriAI/litellm)，仅作参考，请勿用于财务结算依据。
> - 所有采集与分析均在本地完成，不会向第三方服务器上传您的对话或任何隐私数据（仅从 GitHub 拉取公开的 LiteLLM 模型定价 JSON）。

---

## 快速开始（Antigravity 原生插件 — 推荐）

### 环境要求

- 正在运行或本机已保存历史会话的 Antigravity
- [Node.js](https://nodejs.org/) `≥ 22`（内置 `node:sqlite` 支持本地 `.db` 直读，Node 20+ 会自动降级回 RPC/文件系统）

### 3 步从源码构建并接入 Antigravity

```bash
# 1. 克隆仓库并安装依赖
git clone https://github.com/215meng/antigravity-token-monitor.git
cd antigravity-token-monitor
npm install

# 2. 构建 Antigravity MCP App 单文件插件包
npm run build:plugin

# 3. 一键安装到 ~/.gemini/config/plugins/antigravity-token-monitor/
npm run install:plugin
```

> [!TIP]
> 如果您此前手动安装过独立散装技能 `~/.gemini/config/skills/token-monitor/`，升级到本原生插件后建议删除旧目录以避免重复触发——插件已内置完整技能包。

### 在 Antigravity 中的使用方式

1. **左侧全局全页大屏**：直接点击 Antigravity 左侧导航栏的 **Token Monitor**，随时查看完整监控看板（含**本月累计**、**今日消耗**、日历热力图、模型分布、LiteLLM 成本估算与会话排行榜）。
2. **右侧辅助栏常驻面板**：从右侧栏 `+` 菜单打开 **Token 用量**（或在对话中让助手打开），首屏突出显示**本月累计 Token / 估算费用**与**今日消耗**，支持边聊边看与一键刷新。
3. **对话内直接问询**：直接在对话中提问“今天用了多少 token”或“本月累计消耗多少”，内置 `token-monitor` Skill 会自动调用 `get_token_usage_summary` 返回精准报表。

---

## VS Code 扩展（维护模式）

原 VS Code 扩展与 Antigravity 原生插件共享同一套核心引擎与 Svelte 5 组件。如需打包 VSIX：

```bash
# 运行类型检查、测试与 VSIX 打包
npm run typecheck
npm run typecheck:webview
npm run test:webview
npm run package
```

Windows 用户也可以直接运行根目录的一键安装脚本：

```powershell
.\install-extension.ps1
```

或在 VS Code 中按 `Ctrl+Shift+P` 执行 `Extensions: Install from VSIX...` 选择打包生成的 `.vsix` 文件。

---

## 项目架构

```
Core (配置/汇总) → Storage → Data Acquisition → Analysis → Orchestration → Presentation (MCP App / VS Code)
```

- `src/core/` — 无宿主依赖的纯配置管理、通用接口抽象以及统一口径的今日/本月/全量用量汇总
- `src/mcp/` — Antigravity MCP App `stdio` 服务端（SEP-1865 + `com.google.antigravity/ui`）、环境变量直连探测与工具处理器
- `src/rpc/` — 进程探测、HTTP/HTTPS 本地 RPC 客户端、SQLite `.db` 原生解析与增量导出
- `src/parser/` — 规范化 Token 解析与单步每日分模型明细归因
- `src/monitor/` — 会话扫描、跨会话 `responseId` 去重、撤回分支融合、服务调度与文件锁
- `src/pricing/` — 基于 LiteLLM 的模型匹配、别名归一化与成本估算
- `src/storage/` — RPC 缓存及按月分片的会话状态持久化
- `src/statusBar/` & `src/webview/` — Svelte 5 看板 / 侧边栏组件及双模通信/主题自适应桥（Antigravity MCP App + VS Code）
- `plugin-template/` — 已脱敏的开源插件模板（`plugin.json`、`mcp_config.json`、`logo.svg` 与内置 `SKILL.md`）

---

## Inspired By

- **[ddarkr/antigravity-token-monitor](https://github.com/ddarkr/antigravity-token-monitor)** — 原作者与基础项目
- **[antigravity-storage-manager](https://github.com/unchase/antigravity-storage-manager)** — 会话 Token 解析思路参考
- **[tokscale](https://github.com/junhoyeo/tokscale)** — 用量追踪与可视化灵感

---

## License

This project is licensed under the MIT License — see [LICENSE](../LICENSE) for details.
