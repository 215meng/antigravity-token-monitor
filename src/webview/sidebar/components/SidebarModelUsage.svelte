<script lang="ts">
  import type { ModelUsageBreakdown } from '../../../types';
  import { formatCompact, formatUsd } from '../../lib/formatters';
  import { i18n } from '../../lib/i18n';
  import { formatModelDisplayName } from '../../../modelAliases';

  export let models: ModelUsageBreakdown[];

  const MAX_VISIBLE = 5;

  $: visibleModels = models.slice(0, MAX_VISIBLE);
  $: hiddenCount = Math.max(0, models.length - MAX_VISIBLE);
  $: maxTokens = Math.max(...models.map(m => m.totalTokens), 1);
</script>

<section class="model-usage">
  <h3 class="section-label">{$i18n.modelUsageTitle}</h3>

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
            {$i18n.sessionsUnit(model.sessionCount)}
            {#if model.pricingStatus === 'priced' && model.costUsd !== undefined}
              • {formatUsd(model.costUsd)}
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if hiddenCount > 0}
      <div class="more-label">{$i18n.moreModels(hiddenCount)}</div>
    {/if}
  {:else}
    <div class="empty">{$i18n.emptyModels}</div>
  {/if}
</section>

<style>
  .model-usage {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 11px;
    background: var(--surface-glass, var(--surface-subtle));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-elevated);
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
    height: 5px;
    background: var(--track-bg, var(--surface-line));
    border-radius: 999px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-emerald, var(--accent-strong)));
    border-radius: 999px;
    transition: width 0.45s var(--ease-spring, ease);
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
