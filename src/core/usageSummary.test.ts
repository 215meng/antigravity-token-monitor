import { describe, expect, it } from 'vitest';
import type { ActivityHeatmapBin, DashboardState } from '../types';
import {
  buildCompactUsageSummary,
  computePeriodUsage,
  formatUsageSummaryText
} from './usageSummary';

const sampleHeatmap: ActivityHeatmapBin[] = [
  {
    date: '2026-10-31',
    totalTokens: 5000,
    sessionCount: 1,
    inputTokens: 2000,
    outputTokens: 1000,
    cacheReadTokens: 1500,
    cacheWriteTokens: 200,
    reasoningTokens: 300,
    costUsd: 0.05,
    messageCount: 10
  },
  {
    date: '2026-11-05',
    totalTokens: 10000,
    sessionCount: 2,
    inputTokens: 4000,
    outputTokens: 2000,
    cacheReadTokens: 3000,
    cacheWriteTokens: 500,
    reasoningTokens: 500,
    costUsd: 0.12,
    messageCount: 20
  },
  {
    date: '2026-11-24',
    totalTokens: 3000,
    sessionCount: 1,
    inputTokens: 1000,
    outputTokens: 600,
    cacheReadTokens: 1000,
    cacheWriteTokens: 100,
    reasoningTokens: 300,
    costUsd: 0.04,
    messageCount: 6
  },
  {
    date: '2026-11-20',
    totalTokens: 0,
    sessionCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    costUsd: 0,
    messageCount: 0
  }
];

function createMockState(): DashboardState {
  return {
    rootPath: '/mock',
    config: { useRpcExport: true, exportStepsJsonl: false, pollIntervalMs: 60000 },
    syncStatus: 'idle',
    syncMessage: 'ok',
    exportStatus: { status: 'idle', message: 'ok', lastExportedCount: 2 },
    sessions: [],
    summary: {
      sessionCount: 4,
      activeSessionCount: 2,
      archivedSessionCount: 2,
      messageCount: 36,
      changedSessionCount: 1,
      totalTokens: 18000,
      estimatedSessionCount: 0
    },
    pricing: {
      status: 'ready',
      totalCostUsd: 0.21,
      pricedModelCount: 1,
      unpricedModelCount: 0,
      missingModels: [],
      message: 'Ready'
    },
    analytics: {
      activityHeatmap: sampleHeatmap,
      sourceBreakdown: [],
      modeBreakdown: [],
      modelUsage: [
        { model: 'gemini-2.5-pro', totalTokens: 18000, sessionCount: 4, costUsd: 0.21, pricingStatus: 'priced' }
      ],
      rpcCoverage: { trackedSessions: 4, exportedSessions: 4, skippedSessions: 0, changedSessions: 1 }
    }
  };
}

describe('core/usageSummary', () => {
  const now = new Date(2026, 10, 24, 15, 30, 0); // 2026-11-24 local time

  it('computes today and current-month cumulative totals, activeDays and dailyAvgTokens', () => {
    const bundle = computePeriodUsage(sampleHeatmap, now);

    expect(bundle.today.label).toBe('2026-11-24');
    expect(bundle.today.totalTokens).toBe(3000);
    expect(bundle.today.costUsd).toBeCloseTo(0.04, 6);
    expect(bundle.today.activeDays).toBe(1);

    expect(bundle.month.label).toBe('2026-11');
    expect(bundle.month.totalTokens).toBe(13000);
    expect(bundle.month.inputTokens).toBe(5000);
    expect(bundle.month.outputTokens).toBe(2600);
    expect(bundle.month.costUsd).toBeCloseTo(0.16, 6);
    expect(bundle.month.activeDays).toBe(2);
    expect(bundle.month.dailyAvgTokens).toBe(6500);
  });

  it('handles empty heatmap safely', () => {
    const bundle = computePeriodUsage([], now);
    expect(bundle.today.totalTokens).toBe(0);
    expect(bundle.month.totalTokens).toBe(0);
    expect(bundle.month.activeDays).toBe(0);
    expect(bundle.month.dailyAvgTokens).toBe(0);
  });

  it('formats compact summary and readable text for today, month, and all periods', () => {
    const state = createMockState();
    const compact = buildCompactUsageSummary(state, now);
    expect(compact.month.totalTokens).toBe(13000);
    expect(compact.allTime.totalTokens).toBe(18000);

    const todayText = formatUsageSummaryText(state, 'today', now);
    expect(todayText).toContain('今日 Token 用量 (2026-11-24)');
    expect(todayText).toContain('3,000 tokens');

    const monthText = formatUsageSummaryText(state, 'month', now);
    expect(monthText).toContain('本月累计 Token 用量 (2026-11)');
    expect(monthText).toContain('13,000 tokens');
    expect(monthText).toContain('活跃天数: 2 天');

    const allText = formatUsageSummaryText(state, 'all', now);
    expect(allText).toContain('全量累计 Token 用量');
    expect(allText).toContain('18,000 tokens');
  });
});
