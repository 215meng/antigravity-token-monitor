<script lang="ts">
  import type { DashboardState } from '../../../types';
  import { createEmptyPeriodUsage, type PeriodUsageSummary } from '../../../core/usageSummary';
  import { formatCompact, formatUsd } from '../../lib/formatters';
  import { i18n } from '../../lib/i18n';

  export let summary: DashboardState['summary'];
  export let pricing: DashboardState['pricing'];
  export let monthlyUsage: PeriodUsageSummary = createEmptyPeriodUsage();
  export let todayUsage: PeriodUsageSummary = createEmptyPeriodUsage();
</script>

<section class="kpi-section">
  <div class="dual-focal-grid">
    <div class="kpi-card focal-today">
      <div class="kpi-top-row">
        <span class="kpi-pill pill-today">{$i18n.todayFocus}</span>
        <span class="kpi-cost">{todayUsage.costUsd > 0 ? formatUsd(todayUsage.costUsd) : '$0.00'}</span>
      </div>
      <div class="kpi-value highlight-today">{formatCompact(todayUsage.totalTokens)}</div>
      <div class="kpi-subline">
        <span>{todayUsage.messageCount} {$i18n.messagesShort}</span>
        <span>·</span>
        <span>{$i18n.inputShort} {formatCompact(todayUsage.inputTokens)}</span>
      </div>
    </div>

    <div class="kpi-card focal-month">
      <div class="kpi-top-row">
        <span class="kpi-pill pill-month">{$i18n.monthlyCumulative} {monthlyUsage.label || ''}</span>
        <span class="kpi-cost">{monthlyUsage.costUsd > 0 ? formatUsd(monthlyUsage.costUsd) : '$0.00'}</span>
      </div>
      <div class="kpi-value highlight-month">{formatCompact(monthlyUsage.totalTokens)}</div>
      <div class="kpi-subline">
        <span>{monthlyUsage.activeDays} {$i18n.activeDaysSuffix}</span>
        {#if monthlyUsage.dailyAvgTokens > 0}
          <span>·</span>
          <span>{$i18n.dailyAvgPrefix} {formatCompact(monthlyUsage.dailyAvgTokens)}</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card compact">
      <div class="kpi-value">{formatCompact(summary.totalTokens)}</div>
      <div class="kpi-label">{$i18n.totalTokens}</div>
    </div>
    <div class="kpi-card compact">
      <div class="kpi-value">{pricing.pricedModelCount > 0 ? formatUsd(pricing.totalCostUsd) : '—'}</div>
      <div class="kpi-label">{$i18n.estCostShort}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card compact">
      <div class="kpi-value">{summary.activeSessionCount}</div>
      <div class="kpi-label">{$i18n.activeSessionsShort}</div>
    </div>
    <div class="kpi-card compact">
      <div class="kpi-value">{summary.messageCount}</div>
      <div class="kpi-label">{$i18n.messagesShort}</div>
    </div>
  </div>

  <div class="kpi-meta">
    {$i18n.sessionMetaSummary(summary.sessionCount, summary.archivedSessionCount, summary.estimatedSessionCount)}
  </div>
</section>

<style>
  .kpi-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .dual-focal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .kpi-card {
    background: var(--surface-glass, rgba(255, 255, 255, 0.03));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 10px 11px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
    position: relative;
    overflow: hidden;
    box-shadow: var(--shadow-elevated);
    transition: border-color 180ms var(--ease-spring, ease);
  }
  .kpi-card:hover {
    border-color: var(--line-hover, var(--line-strong));
  }
  .kpi-card.focal-today,
  .kpi-card.focal-month {
    padding: 11px;
  }
  .kpi-card.focal-today::before,
  .kpi-card.focal-month::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--edge-highlight);
    opacity: 0.7;
  }
  .kpi-card.focal-today {
    background: linear-gradient(155deg, color-mix(in srgb, var(--accent) 11%, var(--panel)), var(--panel));
    border-color: color-mix(in srgb, var(--accent) 26%, var(--line));
  }
  .kpi-card.focal-month {
    background: linear-gradient(155deg, color-mix(in srgb, var(--accent-strong) 9%, var(--panel)), var(--panel));
    border-color: color-mix(in srgb, var(--accent-strong) 24%, var(--line));
  }
  .kpi-card.compact {
    padding: 8px 10px;
  }
  .kpi-value {
    font-size: 15px;
    font-weight: 400;
    color: var(--text);
    font-family: var(--code-font);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }
  .kpi-value.highlight-today {
    font-size: 20px;
    font-weight: 500;
    color: var(--accent);
    text-shadow: 0 0 18px rgba(94, 234, 212, 0.16);
  }
  .kpi-value.highlight-month {
    font-size: 20px;
    font-weight: 500;
    color: var(--accent-strong);
    text-shadow: 0 0 18px rgba(167, 243, 208, 0.16);
  }
  .kpi-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    letter-spacing: 0.04em;
  }
  .kpi-row {
    display: flex;
    gap: 8px;
  }
  .kpi-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    margin-bottom: 2px;
  }
  .kpi-pill {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pill-today { color: var(--accent); }
  .pill-month { color: var(--accent-strong); }
  .kpi-cost {
    font-size: 10px;
    color: var(--text);
    font-family: var(--code-font);
    font-variant-numeric: tabular-nums;
    opacity: 0.85;
    flex-shrink: 0;
  }
  .kpi-subline {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 2px;
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kpi-meta {
    font-size: 10px;
    color: var(--muted);
    text-align: center;
    padding: 2px var(--spacing-xs) 0;
  }
</style>
