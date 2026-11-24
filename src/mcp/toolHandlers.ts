import { buildCompactUsageSummary, formatUsageSummaryText } from '../core/usageSummary';
import type { DashboardState } from '../types';

export interface McpMonitorController {
  getDashboardState(): DashboardState;
  exportNow(options: { force: boolean; refreshAfter: boolean }): Promise<number>;
  resetCache(): Promise<number>;
}

export type McpToolResponse = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

type RefreshArgs = {
  refresh?: boolean;
};

type SummaryArgs = {
  period?: 'today' | 'month' | 'all';
  refresh?: boolean;
};

const MAX_TRAJECTORY_SAFE_BYTES = 700 * 1024;
const DEFAULT_MAX_VIEW_SESSIONS = 150;

export function buildBoundedDashboardState(
  state: DashboardState,
  maxSessions = DEFAULT_MAX_VIEW_SESSIONS
): DashboardState {
  let limit = Math.min(state.sessions.length, maxSessions);
  let candidate: DashboardState = {
    ...state,
    sessions: state.sessions.slice(0, limit)
  };

  while (limit > 0 && Buffer.byteLength(JSON.stringify(candidate), 'utf8') > MAX_TRAJECTORY_SAFE_BYTES) {
    limit = limit > 20 ? Math.floor(limit / 2) : 0;
    candidate = {
      ...state,
      sessions: state.sessions.slice(0, limit)
    };
  }

  return candidate;
}

async function maybeRefresh(
  controller: McpMonitorController,
  refresh?: boolean
): Promise<void> {
  if (refresh) {
    await controller.exportNow({ force: false, refreshAfter: true });
  }
}

export async function handleOpenViewTool(
  controller: McpMonitorController,
  _view: 'dashboard' | 'sidebar',
  args: RefreshArgs = {}
): Promise<McpToolResponse> {
  await maybeRefresh(controller, args.refresh);
  const state = controller.getDashboardState();
  const boundedState = buildBoundedDashboardState(state);
  const text = formatUsageSummaryText(state, 'month');

  return {
    content: [{ type: 'text', text }],
    structuredContent: boundedState as unknown as Record<string, unknown>
  };
}

export async function handleGetUsageSummaryTool(
  controller: McpMonitorController,
  args: SummaryArgs = {}
): Promise<McpToolResponse> {
  await maybeRefresh(controller, args.refresh);
  const period = args.period ?? 'month';
  const state = controller.getDashboardState();
  const summary = buildCompactUsageSummary(state);
  const text = formatUsageSummaryText(state, period);

  return {
    content: [{ type: 'text', text }],
    structuredContent: {
      period,
      summary
    }
  };
}

export async function handleAppGetDashboardState(
  controller: McpMonitorController
): Promise<McpToolResponse> {
  const state = controller.getDashboardState();
  return {
    content: [
      {
        type: 'text',
        text: `Loaded ${state.summary.sessionCount} sessions (${state.summary.totalTokens} total tokens).`
      }
    ],
    structuredContent: buildBoundedDashboardState(state) as unknown as Record<string, unknown>
  };
}

export async function handleAppRefreshNow(
  controller: McpMonitorController
): Promise<McpToolResponse> {
  const exportedCount = await controller.exportNow({ force: false, refreshAfter: true });
  const state = controller.getDashboardState();
  return {
    content: [
      {
        type: 'text',
        text: `Refreshed dashboard state (${exportedCount} session(s) exported).`
      }
    ],
    structuredContent: buildBoundedDashboardState(state) as unknown as Record<string, unknown>
  };
}

export async function handleAppExportAll(
  controller: McpMonitorController
): Promise<McpToolResponse> {
  const exportedCount = await controller.exportNow({ force: true, refreshAfter: true });
  const state = controller.getDashboardState();
  return {
    content: [
      {
        type: 'text',
        text: `Full export completed (${exportedCount} session(s) exported).`
      }
    ],
    structuredContent: buildBoundedDashboardState(state) as unknown as Record<string, unknown>
  };
}

export async function handleAppResetCache(
  controller: McpMonitorController
): Promise<McpToolResponse> {
  const clearedCount = await controller.resetCache();
  const state = controller.getDashboardState();
  return {
    content: [
      {
        type: 'text',
        text: `Reset cache complete (${clearedCount} session cache(s) cleared).`
      }
    ],
    structuredContent: buildBoundedDashboardState(state) as unknown as Record<string, unknown>
  };
}

export async function dispatchMcpToolCall(
  controller: McpMonitorController,
  name: string,
  rawArgs: Record<string, unknown> | undefined
): Promise<McpToolResponse> {
  const args = rawArgs ?? {};

  switch (name) {
    case 'open_token_dashboard':
      return handleOpenViewTool(controller, 'dashboard', args as RefreshArgs);
    case 'open_token_sidebar':
      return handleOpenViewTool(controller, 'sidebar', args as RefreshArgs);
    case 'get_token_usage_summary':
      return handleGetUsageSummaryTool(controller, args as SummaryArgs);
    case 'app_get_dashboard_state':
      return handleAppGetDashboardState(controller);
    case 'app_refresh_now':
      return handleAppRefreshNow(controller);
    case 'app_export_all':
      return handleAppExportAll(controller);
    case 'app_reset_cache':
      return handleAppResetCache(controller);
    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }]
      };
  }
}
