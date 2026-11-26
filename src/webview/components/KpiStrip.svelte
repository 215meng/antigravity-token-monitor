<script lang="ts">
  import type { DashboardState } from '../../types';
  import { createEmptyPeriodUsage, type PeriodUsageSummary } from '../../core/usageSummary';
  import { formatNumber, formatUsd } from '../lib/formatters';
  import { i18n } from '../lib/i18n';

  export let summary: DashboardState['summary'];
  export let pricing: DashboardState['pricing'];
  export let monthlyUsage: PeriodUsageSummary = createEmptyPeriodUsage();
  export let todayUsage: PeriodUsageSummary = createEmptyPeriodUsage();
</script>

<section class="hero-overview">
  <div class="hero-dual-grid">
    <article class="focal-card focal-today">
      <div class="focal-top">
        <span class="focal-badge badge-today">{$i18n.todayFocus} · {todayUsage.label || $i18n.todayLabel}</span>
        <span class="cost-chip">{todayUsage.costUsd > 0 ? formatUsd(todayUsage.costUsd) : '$0.00'}</span>
      </div>
      <div class="focal-value value-today">{formatNumber(todayUsage.totalTokens)}</div>
      <div class="focal-meta">
        <span>{$i18n.inputShort} {formatNumber(todayUsage.inputTokens)}</span>
        <span class="dot">·</span>
        <span>{$i18n.outputShort} {formatNumber(todayUsage.outputTokens)}</span>
        <span class="dot">·</span>
        <span>{$i18n.cacheShort} {formatNumber(todayUsage.cacheReadTokens + todayUsage.cacheWriteTokens)}</span>
      </div>
    </article>

    <article class="focal-card focal-month">
      <div class="focal-top">
        <span class="focal-badge badge-month">{$i18n.monthlyCumulative} · {monthlyUsage.label || ''}</span>
        <span class="cost-chip">{monthlyUsage.costUsd > 0 ? formatUsd(monthlyUsage.costUsd) : '$0.00'}</span>
      </div>
      <div class="focal-value value-month">{formatNumber(monthlyUsage.totalTokens)}</div>
      <div class="focal-meta">
        <span>{monthlyUsage.activeDays} {$i18n.activeDaysSuffix}</span>
        {#if monthlyUsage.dailyAvgTokens > 0}
          <span class="dot">·</span>
          <span>{$i18n.dailyAvgPrefix} {formatNumber(monthlyUsage.dailyAvgTokens)}</span>
        {/if}
        <span class="dot">·</span>
        <span>{formatNumber(monthlyUsage.messageCount)} {$i18n.messagesShort}</span>
      </div>
    </article>
  </div>

  <div class="metrics-strip">
    <article class="metric-cell">
      <div class="metric-label">{$i18n.totalTokens}</div>
      <div class="metric-value">{formatNumber(summary.totalTokens)}</div>
    </article>

    <article class="metric-cell">
      <div class="metric-label">{$i18n.totalSessions}</div>
      <div class="metric-value">{formatNumber(summary.sessionCount)}</div>
      <div class="metric-context">{formatNumber(summary.activeSessionCount)} {$i18n.activeLabel} · {formatNumber(summary.archivedSessionCount)} {$i18n.archivedLabel}</div>
    </article>

    <article class="metric-cell">
      <div class="metric-label">{$i18n.totalMessages}</div>
      <div class="metric-value">{formatNumber(summary.messageCount)}</div>
    </article>

    <article class="metric-cell">
      <div class="metric-label">{$i18n.totalCost}</div>
      <div class="metric-value">{pricing.pricedModelCount > 0 ? formatUsd(pricing.totalCostUsd) : $i18n.costUnavailable}</div>
      {#if pricing.pricedModelCount === 0 && pricing.message}
        <div class="metric-context">{pricing.message}</div>
      {/if}
    </article>
  </div>
</section>

<style>
  .hero-overview {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  .hero-dual-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-md);
  }
  .focal-card {
    position: relative;
    overflow: hidden;
    background: var(--hero-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 20px 24px;
    box-shadow: var(--shadow-elevated);
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: border-color 220ms var(--ease-spring, ease), transform 220ms var(--ease-spring, ease);
  }
  .focal-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: var(--edge-highlight);
    opacity: 0.75;
  }
  .focal-card:hover {
    border-color: var(--line-hover, var(--line-strong));
    transform: translateY(-1px);
  }
  .focal-today {
    background:
      radial-gradient(circle at 92% 12%, rgba(94, 234, 212, 0.1), transparent 52%),
      var(--hero-bg);
  }
  .focal-month {
    background:
      radial-gradient(circle at 92% 12%, rgba(185, 244, 140, 0.09), transparent 52%),
      var(--hero-bg);
  }
  .focal-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .focal-badge {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .badge-today { color: var(--accent); }
  .badge-month { color: var(--accent-emerald, var(--accent-strong)); }
  .cost-chip {
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--code-font);
    font-variant-numeric: tabular-nums;
    color: var(--text);
    background: var(--surface-subtle);
    border: 1px solid var(--line);
  }
  .focal-value {
    font-size: clamp(26px, 2.8vw, 38px);
    font-weight: 300;
    line-height: 1.08;
    font-family: var(--code-font);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.025em;
    overflow-wrap: anywhere;
  }
  .value-today {
    color: var(--accent);
    text-shadow: 0 0 26px rgba(94, 234, 212, 0.18);
  }
  .value-month {
    color: var(--accent-strong);
    text-shadow: 0 0 26px rgba(167, 243, 208, 0.18);
  }
  .focal-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .dot { opacity: 0.45; }

  .metrics-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    background: var(--surface-glass, var(--panel));
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow-elevated);
    overflow: hidden;
  }
  .metric-cell {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-right: 1px solid var(--surface-line);
    min-width: 0;
  }
  .metric-cell:last-child {
    border-right: none;
  }
  .metric-label {
    color: var(--muted);
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-display);
  }
  .metric-value {
    font-size: clamp(18px, 1.6vw, 24px);
    font-weight: 300;
    line-height: 1.15;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-family: var(--code-font);
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
  .metric-context {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.35;
  }

  @media (max-width: 1100px) {
    .metrics-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .metric-cell:nth-child(2n) {
      border-right: none;
    }
    .metric-cell:nth-child(-n+2) {
      border-bottom: 1px solid var(--surface-line);
    }
  }
  @media (max-width: 720px) {
    .hero-dual-grid,
    .metrics-strip {
      grid-template-columns: 1fr;
    }
    .metric-cell {
      border-right: none;
      border-bottom: 1px solid var(--surface-line);
    }
    .metric-cell:last-child {
      border-bottom: none;
    }
  }
</style>
