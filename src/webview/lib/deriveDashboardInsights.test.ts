import { describe, it, expect } from 'vitest';
import { deriveDashboardInsights } from './deriveDashboardInsights';
import { mockDashboardState } from '../test/fixtures/dashboardState.fixture';

describe('deriveDashboardInsights', () => {
  it('derives insights correctly and sorts by analytical priority', () => {
    const insights = deriveDashboardInsights(mockDashboardState);
    
    expect(insights.hasSessions).toBe(true);
    expect(insights.sortedSessions.length).toBe(2);
    expect(insights.tokenBreakdown.inputTokens).toBe(300);
    expect(insights.tokenBreakdown.outputTokens).toBe(150);
    expect(insights.tokenBreakdown.cacheReadTokens).toBe(60);
    expect(insights.tokenBreakdown.cacheWriteTokens).toBe(30);
    expect(insights.tokenBreakdown.reasoningTokens).toBe(60);
    expect(insights.tokenBreakdown.totalTokens).toBe(600);
    expect(insights.sortedSessions[0].sessionId).toBe('session-1');
    expect(insights.sortedSessions[1].sessionId).toBe('session-2');
  });

  it('handles empty sessions', () => {
    const emptyState = {
      ...mockDashboardState,
      sessions: [],
      summary: { ...mockDashboardState.summary, sessionCount: 0 }
    };
    const insights = deriveDashboardInsights(emptyState);
    
    expect(insights.hasSessions).toBe(false);
    expect(insights.sortedSessions.length).toBe(0);

    const truncatedState = { ...mockDashboardState, sessions: [] };
    expect(deriveDashboardInsights(truncatedState).hasSessions).toBe(true);
  });

  it('derives monthlyUsage and todayUsage from activityHeatmap', () => {
    const stateWithMonthly = {
      ...mockDashboardState,
      analytics: {
        ...mockDashboardState.analytics,
        activityHeatmap: [
          {
            date: '2026-11-10',
            totalTokens: 1200,
            sessionCount: 1,
            inputTokens: 600,
            outputTokens: 300,
            cacheReadTokens: 200,
            cacheWriteTokens: 0,
            reasoningTokens: 100,
            costUsd: 0.01,
            messageCount: 3
          },
          {
            date: '2026-11-24',
            totalTokens: 800,
            sessionCount: 1,
            inputTokens: 400,
            outputTokens: 200,
            cacheReadTokens: 100,
            cacheWriteTokens: 0,
            reasoningTokens: 100,
            costUsd: 0.008,
            messageCount: 2
          }
        ]
      }
    };

    const insights = deriveDashboardInsights(stateWithMonthly, new Date(2026, 10, 24, 12, 0, 0));
    expect(insights.monthlyUsage.label).toBe('2026-11');
    expect(insights.monthlyUsage.totalTokens).toBe(2000);
    expect(insights.monthlyUsage.activeDays).toBe(2);
    expect(insights.monthlyUsage.dailyAvgTokens).toBe(1000);
    expect(insights.todayUsage.label).toBe('2026-11-24');
    expect(insights.todayUsage.totalTokens).toBe(800);
  });
});
