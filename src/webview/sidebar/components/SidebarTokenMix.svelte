<script lang="ts">
  import type { TokenBreakdown } from '../../../types';
  import { formatCompact } from '../../lib/formatters';
  import { i18n } from '../../lib/i18n';

  export let breakdown: TokenBreakdown;
  export let dateLabel = '';

  $: cacheTokens = breakdown.cacheReadTokens + breakdown.cacheWriteTokens;
  $: categorizedTotal = breakdown.inputTokens + breakdown.outputTokens + cacheTokens + breakdown.reasoningTokens;
  $: total = Math.max(categorizedTotal, 1);

  $: items = [
    { key: 'input', label: $i18n.inputShort, tokens: breakdown.inputTokens, pct: (breakdown.inputTokens / total) * 100, color: 'var(--accent)' },
    { key: 'output', label: $i18n.outputShort, tokens: breakdown.outputTokens, pct: (breakdown.outputTokens / total) * 100, color: 'var(--accent-emerald, var(--accent-strong))' },
    { key: 'cache', label: $i18n.cacheShort, tokens: cacheTokens, pct: (cacheTokens / total) * 100, color: 'var(--accent-cache, #60a5fa)' },
    { key: 'reasoning', label: $i18n.reasoningShort, tokens: breakdown.reasoningTokens, pct: (breakdown.reasoningTokens / total) * 100, color: 'var(--warm)' }
  ];

  const formatPct = (pct: number) => pct < 0.1 && pct > 0 ? '<0.1%' : `${pct.toFixed(1)}%`;
</script>

<section class="token-mix">
  <div class="section-header">
    <h3 class="section-label">{$i18n.tokenBreakdownTitle}</h3>
    <span class="section-date">{dateLabel ? `${$i18n.todayPrefix} ${dateLabel}` : $i18n.todayPrefix}</span>
  </div>

  <div class="stacked-bar">
    {#each items as item}
      {#if item.tokens > 0}
        <div
          class="segment"
          style="width: {item.pct}%; background: {item.color}"
          title="{item.label}: {formatCompact(item.tokens)}"
        ></div>
      {/if}
    {/each}
  </div>

  <div class="legend">
    {#each items as item}
      <div class="legend-row">
        <div class="legend-dot" style="background: {item.color}"></div>
        <span class="legend-label">{item.label}</span>
        <span class="legend-value">{formatCompact(item.tokens)}</span>
        <span class="legend-pct">{formatPct(item.pct)}</span>
      </div>
    {/each}
  </div>
</section>

<style>
  .token-mix {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 11px;
    background: var(--surface-glass, var(--surface-subtle));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-elevated);
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-xs);
  }
  .section-label {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .section-date {
    font-size: 10px;
    color: var(--muted);
    font-family: var(--code-font);
  }
  .stacked-bar {
    display: flex;
    height: 16px;
    border-radius: 8px;
    overflow: hidden;
    background: var(--track-bg, rgba(255, 255, 255, 0.04));
    box-shadow: inset 0 0 0 1px var(--surface-line);
  }
  .segment {
    height: 100%;
    transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .segment:not(:last-child) {
    border-right: 1.5px solid var(--bg);
  }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .legend-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    padding: 2px 0;
  }
  .legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .legend-label {
    font-size: 11px;
    color: var(--muted);
    flex: 1;
  }
  .legend-value {
    font-size: 11px;
    font-family: var(--code-font);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
  .legend-pct {
    font-size: 10px;
    color: var(--muted);
    min-width: 36px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
