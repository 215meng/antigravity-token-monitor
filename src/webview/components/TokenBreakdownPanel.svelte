<script lang="ts">
  import type { TokenBreakdown } from '../../types';
  import { formatNumber } from '../lib/formatters';
  import { i18n } from '../lib/i18n';

  export let breakdown: TokenBreakdown;
  export let dateLabel = '';

  $: cacheTokens = breakdown.cacheReadTokens + breakdown.cacheWriteTokens;
  $: categorizedTotal = breakdown.inputTokens + breakdown.outputTokens + cacheTokens + breakdown.reasoningTokens;
  $: total = Math.max(categorizedTotal, 1);
  $: cacheHitPct = categorizedTotal > 0 ? (breakdown.cacheReadTokens / categorizedTotal) * 100 : 0;

  $: items = [
    { key: 'input', label: $i18n.inputLabel, tokens: breakdown.inputTokens, pct: (breakdown.inputTokens / total) * 100 },
    { key: 'output', label: $i18n.outputLabel, tokens: breakdown.outputTokens, pct: (breakdown.outputTokens / total) * 100 },
    { key: 'cache', label: $i18n.cacheLabel, tokens: cacheTokens, pct: (cacheTokens / total) * 100 },
    { key: 'reasoning', label: $i18n.reasoningLabel, tokens: breakdown.reasoningTokens, pct: (breakdown.reasoningTokens / total) * 100 }
  ];

  const formatPct = (pct: number) => pct < 0.1 && pct > 0 ? '<0.1%' : `${pct.toFixed(1)}%`;
</script>

<article class="analytical-card">
  <div class="card-header">
    <h2 class="section-title">{$i18n.tokenBreakdownTitle}</h2>
    <div class="card-meta">{dateLabel ? `${$i18n.todayPrefix} (${dateLabel})` : $i18n.todayPrefix}</div>
  </div>

  <div class="card-body">
    <div class="total-header-row">
      <div class="total-display">
        <span class="total-number">{formatNumber(breakdown.totalTokens)}</span>
        <span class="total-label">{$i18n.todayFocus}</span>
      </div>
      {#if categorizedTotal > 0}
        <span class="cache-hit-badge">
          {$i18n.cacheHitLabel} {formatPct(cacheHitPct)}
        </span>
      {/if}
    </div>

    <div class="coverage-copy">
      <span>{$i18n.classifiedTotal}: {formatNumber(categorizedTotal)}</span>
      {#if breakdown.totalTokens !== categorizedTotal}
        <span>• {formatPct(categorizedTotal / Math.max(breakdown.totalTokens, 1) * 100)} {$i18n.classifiedPct}</span>
      {/if}
    </div>

    <div class="stacked-bar">
      {#each items as item}
        {#if item.tokens > 0}
          <div class="segment {item.key}" style="width: {item.pct}%" title="{item.label}: {formatNumber(item.tokens)}"></div>
        {/if}
      {/each}
    </div>

    <div class="legend">
      {#each items as item}
        <div class="legend-item">
          <div class="legend-color {item.key}"></div>
          <div class="legend-info">
            <span class="legend-label">{item.label}</span>
            <span class="legend-value">{formatNumber(item.tokens)} <span class="legend-pct">({formatPct(item.pct)})</span></span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</article>

<style>
  .analytical-card {
    background: var(--canvas-bg);
    display: flex;
    flex-direction: column;
  }
  .card-header {
    padding: 0 0 var(--spacing-md) 0;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  .section-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
    font-family: var(--font-display);
    letter-spacing: -0.01em;
  }
  .card-meta {
    font-size: 12px;
    color: var(--muted);
  }
  .card-body {
    background: var(--surface-glass, var(--panel));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: var(--shadow-elevated);
    position: relative;
    overflow: hidden;
  }
  .card-body::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--edge-highlight);
    opacity: 0.5;
  }
  .total-header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .cache-hit-badge {
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--code-font);
    color: var(--accent-cache, #60a5fa);
    background: color-mix(in srgb, var(--accent-cache, #60a5fa) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent-cache, #60a5fa) 28%, transparent);
    white-space: nowrap;
  }
  .total-display {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .total-number {
    font-size: 28px;
    font-weight: 300;
    color: var(--text);
    line-height: 1.05;
    font-family: var(--code-font);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
  .total-label {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 600;
    margin-top: var(--spacing-xs);
  }
  .coverage-copy {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
    color: var(--muted);
    font-size: 12px;
  }
  .stacked-bar {
    display: flex;
    height: 24px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--track-bg, rgba(255, 255, 255, 0.06));
    width: 100%;
    box-shadow: inset 0 0 0 1px var(--surface-line);
  }
  .segment {
    height: 100%;
    transition: width 0.55s var(--ease-spring, cubic-bezier(0.4, 0, 0.2, 1));
  }
  .segment:not(:last-child) {
    border-right: 2px solid var(--panel);
  }
  .input { background: var(--accent); }
  .output { background: var(--accent-emerald, var(--accent-strong)); }
  .reasoning { background: var(--warm); }
  .cache { background: var(--accent-cache, #60a5fa); }

  .legend {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--surface-subtle, rgba(255, 255, 255, 0.02));
    border-radius: 10px;
    border: 1px solid var(--surface-line);
    transition: border-color 160ms var(--ease-spring, ease), transform 160ms var(--ease-spring, ease);
  }
  .legend-item:hover {
    border-color: var(--line-hover, var(--line));
    transform: translateX(2px);
  }
  .legend-color {
    width: 14px;
    height: 14px;
    border-radius: 4px;
    margin-top: 2px;
    flex-shrink: 0;
  }
  .legend-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .legend-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .legend-value {
    font-size: 14px;
    font-weight: 400;
    color: var(--text);
    font-family: var(--code-font);
  }
  .legend-pct {
    color: var(--muted);
    font-size: 12px;
    font-weight: 400;
    margin-left: 4px;
  }
</style>
