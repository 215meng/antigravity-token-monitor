---
name: token-monitor
description: Antigravity Token 使用量、本月累计与费用监控工具。当用户询问“今天用了多少 token”、“本月累计用了多少”、“查看 token 使用量”、“统计每日消耗”、“打开 token 监控看板”时使用。
---

# Antigravity Token Monitor

本插件直接运行在 Antigravity 内部，自动扫描本地 `~/.gemini/antigravity` 会话并与本机 Language Server 通信，提供高精度去重后的每日/每月 Token 消耗、模型分布及 LiteLLM 估算费用。

## 可用工具与推荐动作

1. **在对话中直接查询用量（默认首选）**：
   调用 `get_token_usage_summary` 工具：
   - 查询本月累计：`{ "period": "month", "refresh": true }`
   - 查询今日消耗：`{ "period": "today", "refresh": true }`
   - 查询全量历史：`{ "period": "all", "refresh": true }`
2. **在右侧辅助栏打开实时精简面板**：
   当用户希望边聊边看实时数据或打开侧栏面板时，调用 `open_token_sidebar`（可自动在右侧辅助栏弹出/刷新）。
3. **打开全页监控大屏**：
   当用户要求打开完整大屏、查看日历热力图或全部会话详情时，调用 `open_token_dashboard`（也可引导用户直接点击左侧导航栏中的 **Token Monitor** 入口）。
