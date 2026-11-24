<script lang="ts">
  import type { DashboardState } from '../../types';
  import { createEmptyPeriodUsage, type PeriodUsageSummary } from '../../core/usageSummary';
  import { formatNumber, formatUsd } from '../lib/formatters';

  export let summary: DashboardState['summary'];
  export let pricing: DashboardState['pricing'];
  export let monthlyUsage: PeriodUsageSummary = createEmptyPeriodUsage();
  export let todayUsage: PeriodUsageSummary = createEmptyPeriodUsage();
</script>

<section class="stat-band">
  <div class="stat-grid">
    <article class="stat-block primary">
      <div class="stat-label">本月累计 ({monthlyUsage.label || 'This Month'})</div>
      <div class="stat-value highlight">{formatNumber(monthlyUsage.totalTokens)}</div>
      <div class="stat-context">
        {monthlyUsage.costUsd > 0 ? formatUsd(monthlyUsage.costUsd) : '$0.00'} · {monthlyUsage.activeDays} 天活跃 · 今日 {formatNumber(todayUsage.totalTokens)}
      </div>
    </article>

    <div class="stat-divider"></div>

    <article class="stat-block">
      <div class="stat-label">Token 总消耗量 (Total Tokens)</div>
      <div class="stat-value">{formatNumber(summary.totalTokens)}</div>
      <div class="stat-context">全部已扫描会话的 Token 吞吐总量</div>
    </article>

    <div class="stat-divider"></div>

    <article class="stat-block">
      <div class="stat-label">监控会话总数 (Total Sessions)</div>
      <div class="stat-value">{formatNumber(summary.sessionCount)}</div>
      <div class="stat-context">{formatNumber(summary.activeSessionCount)} 活跃，{formatNumber(summary.archivedSessionCount)} 归档</div>
    </article>

    <div class="stat-divider"></div>

    <article class="stat-block">
      <div class="stat-label">交互消息总数 (Total Messages)</div>
      <div class="stat-value">{formatNumber(summary.messageCount)}</div>
      <div class="stat-context">统计全部会话中的消息/Step总数</div>
    </article>

    <div class="stat-divider"></div>

    <article class="stat-block">
      <div class="stat-label">预估总成本 (Total Cost)</div>
      <div class="stat-value">{pricing.pricedModelCount > 0 ? formatUsd(pricing.totalCostUsd) : '不可用'}</div>
      <div class="stat-context">{pricing.message}</div>
    </article>
  </div>
</section>

<style>
  .stat-band {
    background: var(--hero-bg);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: var(--spacing-xl) var(--spacing-lg);
    box-shadow: var(--shadow-elevated);
    position: relative;
    overflow: hidden;
  }
  .stat-band::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--accent), transparent);
    opacity: 0.5;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: minmax(210px, 1.35fr) repeat(4, minmax(130px, 1fr));
    gap: var(--spacing-md);
    align-items: stretch;
    position: relative;
    z-index: 1;
  }
  .stat-block {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: 0 var(--spacing-md);
    border-right: 1px solid var(--line);
  }
  .stat-block:first-child {
    padding-left: 0;
  }
  .stat-block:last-child {
    padding-right: 0;
    border-right: none;
  }
  .stat-divider {
    display: none;
  }
  .stat-label {
    color: var(--muted);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-family: var(--font-display);
  }
  .stat-value {
    font-size: clamp(22px, 2.2vw, 32px);
    font-weight: 300;
    line-height: 1.1;
    color: var(--text);
    font-variant-numeric: tabular-nums;
    font-family: var(--code-font);
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }
  .stat-block:not(:first-child) .stat-value {
    font-size: clamp(18px, 1.6vw, 24px);
  }
  .stat-value.highlight {
    color: var(--accent-strong);
    font-weight: 400;
    text-shadow: 0 0 24px rgba(199, 242, 150, 0.2);
  }
  .stat-context {
    color: var(--muted);
    font-size: 11px;
    line-height: 1.4;
  }
  @media (max-width: 1280px) {
    .stat-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--spacing-lg);
    }
    .stat-block {
      padding: 0 !important;
      border-right: none;
    }
    .stat-block:first-child {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 640px) {
    .stat-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
