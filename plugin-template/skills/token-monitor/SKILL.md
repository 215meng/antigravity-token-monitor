---
name: token-monitor
description: Antigravity TokenScope — Antigravity 原生 Token 使用量、本月累计与成本可观测性工具。当用户询问“今天用了多少 token”、“本月累计用了多少”、“查看 token 使用量”、“统计每日消耗”、“打开 token 监控看板”时使用。
---

# Antigravity TokenScope

本插件（Antigravity TokenScope）直接运行在 Antigravity 内部，自动扫描本地 `~/.gemini/antigravity` 会话并与本机 Language Server 通信，提供零重复、零云端上传的高精度每日/每月 Token 消耗、模型分布及 LiteLLM 估算费用。

## 可用工具与推荐动作

1. **在右侧辅助栏打开实时精简面板（默认推荐）**：
   当用户希望边聊边看实时数据、查看今日/本月汇总或打开侧栏面板时，调用 `open_token_sidebar`（可在右侧辅助栏弹出/刷新，同时返回完整本月与今日用量摘要）。
2. **打开全页可观测性大屏**：
   当用户要求打开完整大屏、查看日历热力图、当日 Token 细分或全部会话详情时，调用 `open_token_dashboard`（也可引导用户直接点击左侧导航栏中的 **TokenScope** 入口）。
3. **纯文本快速查询用量（如已启用）**：
   若宿主启用了 `get_token_usage_summary`，也可直接调用查询 `today` / `month` / `all` 周期汇总。
