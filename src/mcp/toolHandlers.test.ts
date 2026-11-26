import { describe, expect, it, vi } from 'vitest';
import type { DashboardSession, DashboardState } from '../types';
import { dispatchMcpToolCall, type McpMonitorController } from './toolHandlers';

function makeSession(index: number): DashboardSession {
  return {
    sessionId: `session-${index}`,
    label: `Session ${index} ` + 'x'.repeat(200),
    filePath: `/mock/root/session-${index}`,
    lastModifiedMs: 1700000000000 + index,
    status: index < 50 ? 'active' : 'archived',
    lastSeenAt: 1700000000000 + index,
    mode: 'reported',
    source: 'rpc-artifact',
    messageCount: 5,
    latest: {
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 20,
      cacheWriteTokens: 0,
      reasoningTokens: 10,
      totalTokens: 180
    },
    latestDelta: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0
    },
    recentTotals: [100, 150, 180],
    snapshotCount: 3
  };
}

function createFakeState(sessionCount = 2): DashboardState {
  const sessions = Array.from({ length: sessionCount }, (_, idx) => makeSession(idx));
  return {
    rootPath: '/mock/root',
    config: { useRpcExport: true, exportStepsJsonl: false, pollIntervalMs: 60000 },
    lastPollAt: 1700000000000,
    syncStatus: 'idle',
    syncMessage: 'Synced',
    exportStatus: { status: 'idle', message: 'Exported', lastExportedCount: 2 },
    sessions,
    summary: {
      sessionCount,
      activeSessionCount: Math.min(sessionCount, 50),
      archivedSessionCount: Math.max(0, sessionCount - 50),
      messageCount: sessionCount * 5,
      changedSessionCount: 1,
      totalTokens: 9500,
      estimatedSessionCount: 0
    },
    pricing: {
      status: 'ready',
      totalCostUsd: 0.12,
      pricedModelCount: 1,
      unpricedModelCount: 0,
      missingModels: [],
      message: 'Ready'
    },
    analytics: {
      activityHeatmap: [],
      sourceBreakdown: [],
      modeBreakdown: [],
      modelUsage: [],
      rpcCoverage: { trackedSessions: sessionCount, exportedSessions: sessionCount, skippedSessions: 0, changedSessions: 1 }
    }
  };
}

function createController(sessionCount = 2): McpMonitorController & {
  exportNow: ReturnType<typeof vi.fn>;
  resetCache: ReturnType<typeof vi.fn>;
} {
  const state = createFakeState(sessionCount);
  return {
    getDashboardState: () => state,
    exportNow: vi.fn(async () => 4),
    resetCache: vi.fn(async () => 2)
  };
}

describe('mcp/toolHandlers', () => {
  it('returns bounded full DashboardState directly from open_token_dashboard and open_token_sidebar', async () => {
    const controller = createController(2);

    const dash = await dispatchMcpToolCall(controller, 'open_token_dashboard', {});
    expect(dash.isError).toBeUndefined();
    const dashState = dash.structuredContent as unknown as DashboardState;
    expect(dashState.summary.totalTokens).toBe(9500);
    expect(dashState.sessions.length).toBe(2);
    expect(dashState.analytics).toBeTruthy();

    const side = await dispatchMcpToolCall(controller, 'open_token_sidebar', undefined);
    expect(side.isError).toBeUndefined();
    const sideState = side.structuredContent as unknown as DashboardState;
    expect(sideState.summary.sessionCount).toBe(2);
    expect(controller.exportNow).not.toHaveBeenCalled();

    await dispatchMcpToolCall(controller, 'open_token_sidebar', { refresh: true });
    expect(controller.exportNow).toHaveBeenCalledWith({ force: false, refreshAfter: true, forceRefresh: true });
  });

  it('caps large session lists safely below 750 KiB while preserving full summary counts', async () => {
    const controller = createController(2000);
    const dash = await dispatchMcpToolCall(controller, 'open_token_dashboard', {});
    const bytes = Buffer.byteLength(JSON.stringify(dash), 'utf8');
    const dashState = dash.structuredContent as unknown as DashboardState;

    expect(bytes).toBeLessThan(750 * 1024);
    expect(dashState.summary.sessionCount).toBe(2000);
    expect(dashState.sessions.length).toBeLessThanOrEqual(150);
  });

  it('handles get_token_usage_summary for today, month, and all', async () => {
    const controller = createController(2);
    const res = await dispatchMcpToolCall(controller, 'get_token_usage_summary', { period: 'all' });
    expect(res.content[0]?.text).toContain('9,500 tokens');
    expect(res.structuredContent?.period).toBe('all');
  });

  it('handles app-only tools: get state, refresh, export all, reset cache', async () => {
    const controller = createController(2);

    const stateRes = await dispatchMcpToolCall(controller, 'app_get_dashboard_state', {});
    expect((stateRes.structuredContent as unknown as DashboardState).summary.totalTokens).toBe(9500);

    await dispatchMcpToolCall(controller, 'app_refresh_now', {});
    expect(controller.exportNow).toHaveBeenCalledWith({ force: false, refreshAfter: true, forceRefresh: true });

    await dispatchMcpToolCall(controller, 'app_export_all', {});
    expect(controller.exportNow).toHaveBeenCalledWith({ force: true, refreshAfter: true });

    const resetRes = await dispatchMcpToolCall(controller, 'app_reset_cache', {});
    expect(controller.resetCache).toHaveBeenCalledTimes(1);
    expect(resetRes.content[0]?.text).toContain('2 session cache');
  });

  it('returns isError for unknown tool name', async () => {
    const controller = createController(2);
    const res = await dispatchMcpToolCall(controller, 'nonexistent_tool', {});
    expect(res.isError).toBe(true);
  });
});
