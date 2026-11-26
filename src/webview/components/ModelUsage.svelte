<script lang="ts">
  import type { ModelUsageBreakdown } from '../../types';
  import { formatNumber, formatUsd } from '../lib/formatters';
  import { i18n } from '../lib/i18n';
  import { formatModelDisplayName } from '../../modelAliases';

  export let models: ModelUsageBreakdown[];

  $: maxTokens = Math.max(...models.map(m => m.totalTokens), 1);
</script>

<article class="analytical-card">
  <div class="card-header">
    <h2 class="section-title">{$i18n.modelUsageTitle}</h2>
    <div class="card-meta">{$i18n.modelUsageSubtitle}</div>
  </div>

  <div class="card-body">
    {#if models.length > 0}
      <div class="model-list">
        {#each models as model}
          <div class="model-item">
            <div class="model-info">
              <span class="model-name">{formatModelDisplayName(model.model)}</span>
              <span class="model-stats">
                {formatNumber(model.totalTokens)} Tokens • {model.sessionCount} {$i18n.sessionsCountSuffix}
                {#if model.pricingStatus === 'priced' && model.costUsd !== undefined}
                  • {formatUsd(model.costUsd)}
                {:else if model.pricingNote}
                  • {model.pricingNote === 'No LiteLLM pricing match.' ? $i18n.noPricingMatch : model.pricingNote}
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
      <div class="empty-state">{$i18n.emptyModels}</div>
    {/if}
  </div>
</article>

<style>
  .analytical-card {
    background: var(--surface-glass, var(--panel));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-elevated);
    flex: 1;
    position: relative;
  }
  .analytical-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--edge-highlight);
    opacity: 0.45;
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
    font-family: var(--code-font);
  }
  .model-stats {
    color: var(--muted);
    font-size: 11px;
  }
  .bar-container {
    height: 7px;
    background: var(--track-bg, var(--surface-line));
    border-radius: 999px;
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-emerald, var(--accent-strong)));
    border-radius: 999px;
    transition: width 0.5s var(--ease-spring, ease);
  }
  .empty-state {
    color: var(--muted);
    font-size: 12px;
    text-align: center;
    padding: var(--spacing-lg) 0;
  }
</style>
