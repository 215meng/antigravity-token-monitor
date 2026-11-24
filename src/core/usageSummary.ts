import type { ActivityHeatmapBin, DashboardState } from '../types';

export type PeriodUsageSummary = {
  label: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  costUsd: number;
  messageCount: number;
  activeDays: number;
  dailyAvgTokens: number;
};

export type PeriodUsageBundle = {
  today: PeriodUsageSummary;
  month: PeriodUsageSummary;
};

export type CompactUsageSummary = {
  today: PeriodUsageSummary;
  month: PeriodUsageSummary;
  allTime: {
    totalTokens: number;
    totalCostUsd: number;
    sessionCount: number;
    activeSessionCount: number;
    messageCount: number;
    estimatedSessionCount: number;
  };
  topModels: Array<{
    model: string;
    totalTokens: number;
    costUsd?: number;
    pricingStatus: 'priced' | 'unpriced';
  }>;
  syncStatus: DashboardState['syncStatus'];
  lastPollAt?: number;
};

export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatLocalMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function createEmptyPeriodUsage(label = ''): PeriodUsageSummary {
  return {
    label,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
    messageCount: 0,
    activeDays: 0,
    dailyAvgTokens: 0
  };
}

function accumulateBins(bins: ActivityHeatmapBin[], label: string): PeriodUsageSummary {
  const summary = createEmptyPeriodUsage(label);
  for (const bin of bins) {
    summary.totalTokens += bin.totalTokens || 0;
    summary.inputTokens += bin.inputTokens || 0;
    summary.outputTokens += bin.outputTokens || 0;
    summary.cacheReadTokens += bin.cacheReadTokens || 0;
    summary.cacheWriteTokens += bin.cacheWriteTokens || 0;
    summary.reasoningTokens += bin.reasoningTokens || 0;
    summary.costUsd += bin.costUsd || 0;
    summary.messageCount += bin.messageCount || 0;
    if ((bin.totalTokens || 0) > 0) {
      summary.activeDays += 1;
    }
  }
  summary.dailyAvgTokens = summary.activeDays > 0 ? Math.round(summary.totalTokens / summary.activeDays) : 0;
  return summary;
}

export function computePeriodUsage(heatmap: ActivityHeatmapBin[], now: Date = new Date()): PeriodUsageBundle {
  const todayKey = formatLocalDateKey(now);
  const monthKey = formatLocalMonthKey(now);

  const todayBins = heatmap.filter((bin) => bin.date === todayKey);
  const monthBins = heatmap.filter((bin) => bin.date.startsWith(monthKey));

  return {
    today: accumulateBins(todayBins, todayKey),
    month: accumulateBins(monthBins, monthKey)
  };
}

export function buildCompactUsageSummary(state: DashboardState, now: Date = new Date()): CompactUsageSummary {
  const { today, month } = computePeriodUsage(state.analytics.activityHeatmap, now);
  return {
    today,
    month,
    allTime: {
      totalTokens: state.summary.totalTokens,
      totalCostUsd: state.pricing.totalCostUsd,
      sessionCount: state.summary.sessionCount,
      activeSessionCount: state.summary.activeSessionCount,
      messageCount: state.summary.messageCount,
      estimatedSessionCount: state.summary.estimatedSessionCount
    },
    topModels: state.analytics.modelUsage.slice(0, 5).map((m) => ({
      model: m.model,
      totalTokens: m.totalTokens,
      costUsd: m.costUsd,
      pricingStatus: m.pricingStatus
    })),
    syncStatus: state.syncStatus,
    lastPollAt: state.lastPollAt
  };
}

function fmtInt(value: number): string {
  return Math.round(value).toLocaleString('en-US');
}

function fmtUsd(value: number): string {
  return `$${value.toFixed(4)}`;
}

export function formatUsageSummaryText(
  state: DashboardState,
  period: 'today' | 'month' | 'all' = 'month',
  now: Date = new Date()
): string {
  const compact = buildCompactUsageSummary(state, now);
  const lines: string[] = [];

  if (period === 'today') {
    const t = compact.today;
    lines.push(`Antigravity 今日 Token 用量 (${t.label})`);
    lines.push(`- 总计: ${fmtInt(t.totalTokens)} tokens | 预估费用: ${fmtUsd(t.costUsd)} | 消息数: ${fmtInt(t.messageCount)}`);
    lines.push(
      `- 构成: Input ${fmtInt(t.inputTokens)} | Output ${fmtInt(t.outputTokens)} | Reasoning ${fmtInt(t.reasoningTokens)} | CacheRead ${fmtInt(t.cacheReadTokens)} | CacheWrite ${fmtInt(t.cacheWriteTokens)}`
    );
    lines.push(`- 同期本月累计 (${compact.month.label}): ${fmtInt(compact.month.totalTokens)} tokens (${fmtUsd(compact.month.costUsd)})`);
  } else if (period === 'all') {
    const a = compact.allTime;
    lines.push('Antigravity 全量累计 Token 用量');
    lines.push(`- 总计: ${fmtInt(a.totalTokens)} tokens | 预估费用: ${fmtUsd(a.totalCostUsd)}`);
    lines.push(`- 会话数: ${fmtInt(a.sessionCount)} (${fmtInt(a.activeSessionCount)} 活跃) | 消息数: ${fmtInt(a.messageCount)} | 估算模式会话: ${fmtInt(a.estimatedSessionCount)}`);
    lines.push(`- 本月累计 (${compact.month.label}): ${fmtInt(compact.month.totalTokens)} tokens | 今日 (${compact.today.label}): ${fmtInt(compact.today.totalTokens)} tokens`);
  } else {
    const m = compact.month;
    lines.push(`Antigravity 本月累计 Token 用量 (${m.label})`);
    lines.push(`- 总计: ${fmtInt(m.totalTokens)} tokens | 预估费用: ${fmtUsd(m.costUsd)}`);
    lines.push(`- 活跃天数: ${m.activeDays} 天 | 日均消耗: ${fmtInt(m.dailyAvgTokens)} tokens | 消息数: ${fmtInt(m.messageCount)}`);
    lines.push(
      `- 构成: Input ${fmtInt(m.inputTokens)} | Output ${fmtInt(m.outputTokens)} | Reasoning ${fmtInt(m.reasoningTokens)} | CacheRead ${fmtInt(m.cacheReadTokens)} | CacheWrite ${fmtInt(m.cacheWriteTokens)}`
    );
    lines.push(`- 今日消耗 (${compact.today.label}): ${fmtInt(compact.today.totalTokens)} tokens (${fmtUsd(compact.today.costUsd)})`);
  }

  if (compact.topModels.length > 0) {
    const modelStr = compact.topModels
      .map((m) => `${m.model}: ${fmtInt(m.totalTokens)}${m.costUsd !== undefined ? ` (${fmtUsd(m.costUsd)})` : ''}`)
      .join(' | ');
    lines.push(`- 主要模型 (全量 Top ${compact.topModels.length}): ${modelStr}`);
  }

  return lines.join('\n');
}
