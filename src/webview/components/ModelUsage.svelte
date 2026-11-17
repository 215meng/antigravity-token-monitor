<script lang="ts">
  import type { ModelUsageBreakdown } from '../../types';
  import { formatNumber, formatUsd } from '../lib/formatters';
  import { formatModelDisplayName } from '../../modelAliases';

  export let models: ModelUsageBreakdown[];

  $: maxTokens = Math.max(...models.map(m => m.totalTokens), 1);
</script>

<article class="analytical-card">
  <div class="card-header">
    <h2 class="section-title">模型使用分布</h2>
    <div class="card-meta">按总 Token 消耗量排序</div>
  </div>

  <div class="card-body">
    {#if models.length > 0}
      <div class="model-list">
        {#each models as model}
          <div class="model-item">
            <div class="model-info">
              <span class="model-name">{formatModelDisplayName(model.model)}</span>
              <span class="model-stats">
                {formatNumber(model.totalTokens)} Tokens • {model.sessionCount} 个会话
                {#if model.pricingStatus === 'priced' && model.costUsd !== undefined}
                  • {formatUsd(model.costUsd)}
                {:else if model.pricingNote}
                  • {model.pricingNote === 'No LiteLLM pricing match.' ? '未匹配 LiteLLM 价格表' : model.pricingNote}
                {/if}
              </span>
            </div>
            <div class="bar-container">
              <div class="bar" style="width: {(model.totalTokens / maxTokens) * 100}%"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="empty-state">暂无模型使用数据</div>
    {/if}
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
  }
  .model-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .model-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .model-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
  }
  .model-name {
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-mono);
  }
  .model-stats {
    color: var(--muted);
    font-size: 11px;
  }
  .bar-container {
    height: 6px;
    background: var(--surface-line);
    border-radius: 3px;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }
  .empty-state {
    color: var(--muted);
    font-size: 12px;
    text-align: center;
    padding: var(--spacing-lg) 0;
  }
</style>
