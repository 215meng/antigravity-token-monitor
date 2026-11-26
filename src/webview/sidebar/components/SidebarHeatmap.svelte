<script lang="ts">
  import type { ActivityHeatmapBin } from '../../../types';
  import { formatCompact, formatUsd } from '../../lib/formatters';
  import { i18n, locale } from '../../lib/i18n';

  export let heatmap: ActivityHeatmapBin[];

  const DAYS_TO_SHOW = 30;

  $: recentBins = heatmap.slice(-DAYS_TO_SHOW);
  $: sortedNonZeroTokens = recentBins
    .map((b) => b.totalTokens)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  $: maxTokens = sortedNonZeroTokens.length > 0 ? sortedNonZeroTokens[sortedNonZeroTokens.length - 1] : 1;

  function getHeatmapLevel(tokens: number, sorted: number[], maxVal: number): number {
    if (tokens <= 0 || sorted.length === 0) return 0;
    const count = sorted.length;
    if (count === 1) return 10;
    let rankIndex = sorted.findIndex((v) => v >= tokens);
    if (rankIndex < 0) rankIndex = count - 1;
    const rankRatio = rankIndex / Math.max(count - 1, 1);
    const powRatio = Math.pow(tokens / Math.max(maxVal, 1), 0.45);
    const score = 0.55 * rankRatio + 0.45 * powRatio;
    return Math.max(1, Math.min(10, Math.round(1 + score * 9)));
  }

  function formatDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString($locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' });
  }

  let hoveredBin: ActivityHeatmapBin | null = null;
</script>

<section class="mini-heatmap">
  <h3 class="section-label">{$i18n.last30Days}</h3>

  <div class="heatmap-grid">
    {#each recentBins as bin}
      {@const level = getHeatmapLevel(bin.totalTokens, sortedNonZeroTokens, maxTokens)}
      <div
        class="cell"
        class:cell--empty={bin.totalTokens === 0}
        style="background-color: var(--hm-{level}); border-color: {level === 0 ? 'var(--hm-border-0)' : 'transparent'}"
        title="{formatDateLabel(bin.date)}: {formatCompact(bin.totalTokens)} tokens"
        on:mouseenter={() => hoveredBin = bin}
        on:mouseleave={() => hoveredBin = null}
        role="button"
        tabindex="0"
      ></div>
    {/each}
  </div>

  {#if hoveredBin && hoveredBin.totalTokens > 0}
    <div class="heatmap-detail">
      <span class="detail-date">{formatDateLabel(hoveredBin.date)}</span>
      <span class="detail-tokens">{formatCompact(hoveredBin.totalTokens)} tokens</span>
      {#if hoveredBin.costUsd > 0}
        <span class="detail-cost">{formatUsd(hoveredBin.costUsd)}</span>
      {/if}
      <span class="detail-sessions">{hoveredBin.sessionCount} session{hoveredBin.sessionCount !== 1 ? 's' : ''}</span>
    </div>
  {/if}
</section>

<style>
  .mini-heatmap {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: 10px 11px;
    background: var(--surface-glass, var(--surface-subtle));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-elevated);
  }
  .section-label {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted);
  }
  .heatmap-grid {
    display: grid;
    grid-template-columns: repeat(10, 1fr);
    gap: 2px;
  }
  .cell {
    aspect-ratio: 1;
    border-radius: 2px;
    border: 1px solid transparent;
    transition: transform 0.15s, border-color 0.15s;
    cursor: default;
    min-width: 0;
  }
  .cell:not(.cell--empty):hover {
    transform: scale(1.3);
    border-color: var(--accent-strong);
    z-index: 5;
    position: relative;
    cursor: pointer;
  }
  .cell--empty {
    border-color: var(--surface-line);
  }
  .heatmap-detail {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    align-items: baseline;
    font-size: 10px;
    color: var(--muted);
    padding: var(--spacing-xs) 0;
    animation: detail-in 120ms ease;
  }
  .detail-date {
    font-weight: 600;
    color: var(--text);
  }
  .detail-tokens {
    font-family: var(--code-font);
    color: var(--accent-strong);
    font-weight: 500;
  }
  .detail-cost {
    font-family: var(--code-font);
  }
  @keyframes detail-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>
