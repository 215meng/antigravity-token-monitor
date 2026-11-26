<script lang="ts">
  import type { ActivityHeatmapBin } from '../../types';
  import { formatCompact, formatUsd } from '../lib/formatters';
  import { i18n, locale } from '../lib/i18n';
  import { onDestroy, onMount, tick } from 'svelte';

  export let heatmap: ActivityHeatmapBin[];

  let containerRef: HTMLElement;

  // Popover state
  let hoveredBin: (ActivityHeatmapBin & { isEmpty?: boolean }) | null = null;
  let popoverX = 0;
  let popoverY = 0;
  let popoverBelow = false;
  let popoverVisible = false;
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  function hidePopoverNow() {
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    popoverVisible = false;
    hoveredBin = null;
  }

  function handleCellEnter(e: MouseEvent, bin: ActivityHeatmapBin & { isEmpty?: boolean }) {
    if (bin.isEmpty || bin.totalTokens === 0) {
      return;
    }
    if (hideTimeout) {
      clearTimeout(hideTimeout);
      hideTimeout = null;
    }
    hoveredBin = bin;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const rawCenterX = rect.left + rect.width / 2;

    popoverX = Math.max(130, Math.min(viewportWidth - 130, rawCenterX));
    if (rect.top < 270) {
      popoverBelow = true;
      popoverY = rect.bottom + 10;
    } else {
      popoverBelow = false;
      popoverY = rect.top - 10;
    }
    popoverVisible = true;
  }

  function handleCellLeave() {
    hideTimeout = setTimeout(() => {
      popoverVisible = false;
      hoveredBin = null;
    }, 150);
  }

  onMount(() => {
    window.addEventListener('scroll', hidePopoverNow, true);
    window.addEventListener('resize', hidePopoverNow);
  });

  onDestroy(() => {
    window.removeEventListener('scroll', hidePopoverNow, true);
    window.removeEventListener('resize', hidePopoverNow);
    hidePopoverNow();
  });

  function formatDateLabel(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString($locale === 'en' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  $: sortedNonZeroTokens = heatmap
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

  $: dayLabels = $i18n.dayLabels;
  const legendLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  $: paddedHeatmap = (() => {
    if (!heatmap.length) return [];
    
    const [y, m, d] = heatmap[0].date.split('-').map(Number);
    const firstDate = new Date(y, m - 1, d);
    const firstDayOfWeek = firstDate.getDay();
    
    const padding = Array(firstDayOfWeek).fill({
      date: '',
      totalTokens: 0,
      sessionCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      costUsd: 0,
      messageCount: 0,
      isEmpty: true
    });
    
    return [...padding, ...heatmap.map(b => ({ ...b, isEmpty: false }))];
  })();

  $: columnsCount = Math.ceil(paddedHeatmap.length / 7);

  $: monthLabels = (() => {
    if (paddedHeatmap.length === 0) return [];

    const labels: { name: string; span: number }[] = [];
    let currentMonth = -1;
    let span = 0;
    
    for (let w = 0; w < columnsCount; w++) {
       let weekStartDate: Date | null = null;
       for (let d = 0; d < 7; d++) {
         const bin = paddedHeatmap[w * 7 + d];
         if (bin && !bin.isEmpty) {
           const [yr, mo, da] = bin.date.split('-').map(Number);
           weekStartDate = new Date(yr, mo - 1, da);
           break;
         }
       }
       if (weekStartDate) {
         const m = weekStartDate.getMonth();
         if (m !== currentMonth) {
           if (currentMonth !== -1) {
             labels[labels.length - 1].span = span;
           }
           // avoid duplicate adjacent month labels or very short spans at boundaries
           labels.push({ name: weekStartDate.toLocaleString('en-US', { month: 'short' }), span: 1 });
           currentMonth = m;
           span = 1;
         } else {
           span++;
         }
       } else {
         span++;
       }
    }
    if (labels.length > 0) {
      labels[labels.length - 1].span = span;
    }
    return labels;
  })();

  $: if (containerRef && heatmap.length) {
    tick().then(() => {
      setTimeout(() => {
        if (containerRef) {
          containerRef.scrollLeft = containerRef.scrollWidth;
        }
      }, 50);
    });
  }
</script>

<article class="analytical-card">
  <div class="card-header">
    <div class="header-left">
      <h2 class="section-title">{$i18n.heatmapTitle}</h2>
      <div class="card-meta">{$i18n.heatmapSubtitle}</div>
    </div>
    <div class="heatmap-legend" aria-hidden="true">
      <span class="legend-text">{$i18n.heatmapLess}</span>
      <span class="legend-swatch" style="background: var(--hm-0); border-color: var(--hm-border-0);"></span>
      {#each legendLevels as lvl}
        <span class="legend-swatch" style="background: var(--hm-{lvl});"></span>
      {/each}
      <span class="legend-text">{$i18n.heatmapMore}</span>
    </div>
  </div>

  <div class="heatmap-container" bind:this={containerRef} on:scroll={hidePopoverNow}>
    <div class="calendar-container">
      <div class="months-header" style="grid-template-columns: repeat({columnsCount}, 12px);">
        {#each monthLabels as label}
           <div class="month-label" style="grid-column: span {label.span};">{label.name}</div>
        {/each}
      </div>

      <div class="calendar-body">
        <div class="days-column">
          {#each dayLabels as day, i}
             <div class="day-label">{i % 2 !== 0 ? day : ''}</div>
          {/each}
        </div>

        <div class="heatmap-grid" style="grid-template-rows: repeat(7, 12px);">
           {#each paddedHeatmap as bin}
              {#if bin.isEmpty}
                <div class="cell-empty"></div>
              {:else}
                {@const tokens = bin.totalTokens || 0}
                {@const level = getHeatmapLevel(tokens, sortedNonZeroTokens, maxTokens)}
                <div
                  role="button"
                  tabindex="0"
                  class="heatmap-cell"
                  style="background-color: var(--hm-{level}); border-color: {level === 0 ? 'var(--hm-border-0)' : 'transparent'}"
                  on:mouseenter={(e) => handleCellEnter(e, bin)}
                  on:mouseleave={handleCellLeave}
                ></div>
              {/if}
           {/each}
        </div>
      </div>
    </div>
  </div>
</article>

{#if popoverVisible && hoveredBin}
  <div
    role="tooltip"
    class="heatmap-popover"
    class:below={popoverBelow}
    style="left: {popoverX}px; top: {popoverY}px;"
    on:mouseenter={() => { if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; } }}
    on:mouseleave={handleCellLeave}
  >
    <div class="popover-date">{formatDateLabel(hoveredBin.date)}</div>
    <div class="popover-divider"></div>

    <div class="popover-row popover-row--highlight">
      <span class="popover-label">{$i18n.tokenThroughput}</span>
      <span class="popover-value popover-value--accent">{formatCompact(hoveredBin.totalTokens)}</span>
    </div>

    <div class="popover-divider"></div>

    <div class="popover-row">
      <span class="popover-label">{$i18n.inputDesc}</span>
      <span class="popover-value">{formatCompact(hoveredBin.inputTokens)}</span>
    </div>
    <div class="popover-row">
      <span class="popover-label">{$i18n.outputDesc}</span>
      <span class="popover-value">{formatCompact(hoveredBin.outputTokens)}</span>
    </div>
    <div class="popover-row">
      <span class="popover-label">{$i18n.cacheReadDesc}</span>
      <span class="popover-value">{formatCompact(hoveredBin.cacheReadTokens)}</span>
    </div>
    <div class="popover-row">
      <span class="popover-label">{$i18n.cacheWriteDesc}</span>
      <span class="popover-value">{formatCompact(hoveredBin.cacheWriteTokens)}</span>
    </div>
    <div class="popover-row">
      <span class="popover-label">{$i18n.reasoningDesc}</span>
      <span class="popover-value">{formatCompact(hoveredBin.reasoningTokens)}</span>
    </div>

    <div class="popover-divider"></div>

    <div class="popover-row">
      <span class="popover-label">{$i18n.estimatedCostLabel}</span>
      <span class="popover-value">{hoveredBin.costUsd > 0 ? formatUsd(hoveredBin.costUsd) : '—'}</span>
    </div>
    <div class="popover-row">
      <span class="popover-label">{$i18n.messagesCountLabel}</span>
      <span class="popover-value">{hoveredBin.messageCount}</span>
    </div>
  </div>
{/if}

<style>
  .analytical-card {
    background: var(--surface-glass, var(--panel));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: var(--shadow-elevated);
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
    flex-wrap: wrap;
    gap: 8px;
    background: rgba(255, 255, 255, 0.01);
  }
  .header-left {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .heatmap-legend {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .legend-text {
    font-size: 10px;
    color: var(--muted);
    margin: 0 3px;
  }
  .legend-swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid transparent;
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
  .heatmap-container {
    padding: var(--spacing-md);
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--line) transparent;
    text-align: center;
    position: relative;
  }
  .heatmap-container::-webkit-scrollbar {
    height: 8px;
  }
  .heatmap-container::-webkit-scrollbar-thumb {
    background-color: var(--line);
    border-radius: 4px;
    border: 2px solid var(--panel);
  }
  .calendar-container {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
    min-width: max-content;
    text-align: left;
  }
  .months-header {
    padding-left: 28px; /* sync with .days-column width + gap */
    display: grid;
    gap: 3px;
    height: 14px;
  }
  .month-label {
    font-size: 10px;
    color: var(--muted);
    line-height: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .calendar-body {
    display: flex;
    gap: 4px;
  }
  .days-column {
    display: grid;
    grid-template-rows: repeat(7, 12px);
    gap: 3px;
    width: 24px;
    text-align: right;
  }
  .day-label {
    font-size: 9px;
    line-height: 12px;
    color: var(--muted);
  }
  .heatmap-grid {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: 12px;
    gap: 3px;
  }
  .cell-empty {
    width: 12px;
    height: 12px;
  }
  .heatmap-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    border: 1px solid transparent; /* default transparent to avoid flicker */
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s;
    cursor: pointer;
  }
  .heatmap-cell:hover {
    transform: scale(1.35);
    z-index: 10;
    position: relative;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    border-color: var(--accent-strong) !important;
  }

  /* Popover styles */
  .heatmap-popover {
    position: fixed;
    z-index: 2147483647;
    isolation: isolate;
    transform: translate(-50%, -100%);
    min-width: 240px;
    background: var(--popover-bg, #151d20);
    color: var(--text);
    border: 1px solid var(--line-strong, var(--line));
    border-radius: 10px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35), 0 2px 10px rgba(0, 0, 0, 0.2);
    padding: 14px 16px;
    pointer-events: auto;
    animation: popover-in 0.14s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .heatmap-popover.below {
    transform: translate(-50%, 0);
  }

  @keyframes popover-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .popover-date {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    margin-bottom: 2px;
  }

  .popover-divider {
    height: 1px;
    background: var(--line);
    margin: 10px 0;
  }

  .popover-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
  }

  .popover-row--highlight {
    padding: 4px 0;
  }

  .popover-label {
    font-size: 12px;
    color: var(--muted);
  }

  .popover-value {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }

  .popover-value--accent {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent-strong, #2a9df4);
  }
</style>
