# Antigravity Token Monitor (增强与精确核算版)

[English](../README.md) | **简体中文**

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-FF3E00?logo=svelte)](https://svelte.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 在 VS Code 面板与侧边栏中实时、精准地收集、去重、核算并可视化您的 Antigravity 会话 Token 使用量。

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
  - 支持最新模型家族解析、官方前缀匹配与定价映射（Gemini 4 Neon / Argon / Hydrogen / Carbon、Orchestrator (Neon / Argon)、Gemini 3.8 Flash 全档位、Claude Opus/Sonnet 5.5 & 4.6、GPT-OSS 120B 等）。
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

## 快速开始（Getting Started）

### 环境要求

- [VS Code](https://code.visualstudio.com/) `≥ 1.96.0`
- [Node.js](https://nodejs.org/) `≥ 22`（内置 `node:sqlite` 支持本地 `.db` 直读，若低于 22 则自动降级回 RPC/文件系统）
- 正在运行或本机已保存历史会话的 Antigravity

### 从源码编译与安装

```bash
# 克隆仓库
git clone https://github.com/215meng/antigravity-token-monitor.git
cd antigravity-token-monitor

# 安装依赖
npm install

# 运行类型检查与测试
npm run typecheck
npm run typecheck:webview
npm run test:webview

# 可选：在终端快速核验本机每日消耗
npm run usage

# 编译并打包 VSIX
npm run package
```

Windows 用户也可以直接运行根目录的一键安装脚本：

```powershell
.\install-extension.ps1
```

或在 VS Code 中按 `Ctrl+Shift+P` 执行 `Extensions: Install from VSIX...` 选择打包生成的 `.vsix` 文件。

### 使用方式

1. 打开命令面板（`Cmd+Shift+P` / `Ctrl+Shift+P`）
2. 运行 `Antigravity Token 监控: 打开监控面板`
3. 也可直接点击状态栏右侧的 Token 统计数字，或点击左侧 Activity Bar 图标查看侧边栏迷你概览。

---

## 项目架构

```
Data Acquisition → Analysis → Orchestration → Presentation
```

- `src/rpc/` — 进程探测、HTTPS RPC 客户端、SQLite `.db` 原生解析与增量导出
- `src/parser/` — 规范化 Token 解析与单步每日分模型明细归因
- `src/monitor/` — 会话扫描、跨会话 `responseId` 去重、撤回分支融合、服务调度与文件锁
- `src/pricing/` — 基于 LiteLLM 的模型匹配、别名归一化与成本估算
- `src/storage/` — RPC 缓存及按月分片的会话状态持久化
- `src/statusBar/` & `src/webview/` — 状态栏与 Svelte 5 看板 / 侧边栏界面

---

## Inspired By

- **[ddarkr/antigravity-token-monitor](https://github.com/ddarkr/antigravity-token-monitor)** — 原作者与基础项目
- **[antigravity-storage-manager](https://github.com/unchase/antigravity-storage-manager)** — 会话 Token 解析思路参考
- **[tokscale](https://github.com/junhoyeo/tokscale)** — 用量追踪与可视化灵感

---

## License

This project is licensed under the MIT License — see [LICENSE](../LICENSE) for details.
