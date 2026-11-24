<script lang="ts">
  import type { ModelUsageBreakdown } from '../../../types';
  import { formatCompact, formatUsd } from '../../lib/formatters';
  import { formatModelDisplayName } from '../../../modelAliases';

  export let models: ModelUsageBreakdown[];

  const MAX_VISIBLE = 5;

  $: visibleModels = models.slice(0, MAX_VISIBLE);
  $: hiddenCount = Math.max(0, models.length - MAX_VISIBLE);
  $: maxTokens = Math.max(...models.map(m => m.totalTokens), 1);
</script>

<section class="model-usage">
  <h3 class="section-label">模型使用分布</h3>

  {#if visibleModels.length > 0}
    <div class="model-list">
      {#each visibleModels as model}
        <div class="model-item">
          <div class="model-header">
            <span class="model-name" title={formatModelDisplayName(model.model)}>{formatModelDisplayName(model.model)}</span>
            <span class="model-tokens">{formatCompact(model.totalTokens)}</span>
          </div>
          <div class="bar-track">
            <div
              class="bar-fill"
              style="width: {(model.totalTokens / maxTokens) * 100}%"
            ></div>
          </div>
          <div class="model-meta">
            {model.sessionCount} 个会话
            {#if model.pricingStatus === 'priced' && model.costUsd !== undefined}
              • {formatUsd(model.costUsd)}
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if hiddenCount > 0}
      <div class="more-label">+ 还有 {hiddenCount} 个模型</div>
    {/if}
  {:else}
    <div class="empty">暂无模型数据</div>
  {/if}
</section>

<style>
  .model-usage {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }
  .section-label {
    margin: 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .model-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .model-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .model-header {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
  }
  .model-name {
    font-family: var(--code-font);
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 140px;
  }
  .model-tokens {
    color: var(--muted);
  }
  .bar-track {
    height: 4px;
    background: var(--surface-line);
    border-radius: 2px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
  }
  .model-meta {
    font-size: 10px;
    color: var(--muted);
  }
  .more-label {
    font-size: 11px;
    color: var(--muted);
    text-align: center;
    padding: var(--spacing-xs) 0;
  }
  .empty {
    font-size: 11px;
    color: var(--muted);
    padding: var(--spacing-xs) 0;
  }
</style>
