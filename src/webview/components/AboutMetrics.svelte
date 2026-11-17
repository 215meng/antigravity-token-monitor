<script lang="ts">
</script>

<article class="analytical-card">
  <div class="card-header">
    <h2 class="section-title">指标与口径说明</h2>
    <div class="card-meta">数据核算口径</div>
  </div>

  <div class="card-body">
    <div class="info-card">
      <ul class="info-list">
        <li>
          <span class="highlight">官方上报 (Reported)</span>：直接从 Antigravity 底层语言服务器 RPC 获取的精准 Token 载荷。
        </li>
        <li>
          <span class="highlight">文本估算 (Estimated)</span>：当会话无结构化 RPC 载荷时的保底字符估算。
        </li>
        <li>
          💡 去重与精确核算：按唯一请求 ID (`responseId`) 消除父子会话/Subagent 历史克隆重复，正交拆分纯答复输出与深度思考 Token，并自动融合被撤回/重发分支的历史真实调用，全面覆盖活跃与归档会话。
        </li>
        <li>
          📅 每日热力图：严格依据每次模型调用的真实发生时间戳归入当天日期，不会因后续对话而迁移历史日期用量。
        </li>
      </ul>
    </div>
  </div>
</article>

<style>
  .analytical-card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-elevated);
    flex: 1;
  }
  .card-header {
    padding: var(--spacing-sm) var(--spacing-md);
    border-bottom: 1px solid var(--line);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.01);
  }
  .section-title {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .card-meta {
    font-size: 11px;
    color: var(--muted);
  }
  .card-body {
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .info-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--surface-line);
    border-radius: 8px;
    padding: var(--spacing-sm);
    flex: 1;
  }

  .info-list {
    margin: 0;
    padding: 0 0 0 var(--spacing-md);
    font-size: 11px;
    color: var(--muted);
    line-height: 1.5;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .highlight {
    color: var(--text);
    font-weight: 500;
  }
</style>
