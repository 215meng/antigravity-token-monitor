import { App } from '@modelcontextprotocol/ext-apps';
import type { DashboardState } from '../../types';
import { dashboardError, dashboardRefreshing, dashboardState } from '../lib/dashboardStore';
import { setHostMessageHandler } from '../lib/hostBridge';
import { applyMcpHostContext } from '../lib/themeBridge';

export type McpAppViewKind = 'dashboard' | 'sidebar';

type FetchMode = 'read' | 'refresh' | 'exportAll' | 'resetCache';

const POLL_INTERVAL_MS = 2000;
const INITIAL_FALLBACK_DELAY_MS = 300;
const MAX_EMPTY_POLL_ATTEMPTS = 60;

function isDashboardState(value: unknown): value is DashboardState {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<DashboardState>;
  return Boolean(
    candidate.summary &&
      Array.isArray(candidate.sessions) &&
      candidate.analytics
  );
}

function shouldContinuePolling(state: DashboardState): boolean {
  if (state.syncStatus === 'running' || state.exportStatus.status === 'running') {
    return true;
  }
  return state.sessions.length === 0 && !state.lastPollAt;
}

export async function initMcpAppRuntime(view: McpAppViewKind): Promise<App> {
  const entrypointTool =
    view === 'dashboard' ? 'open_token_dashboard' : 'open_token_sidebar';

  const app = new App(
    { name: 'Antigravity TokenScope', version: '1.1.0' },
    {}
  );

  let inFlight = false;
  let hasReceivedState = false;
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let emptyPollCount = 0;

  const clearPollTimer = () => {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const schedulePollIfNeeded = (state: DashboardState) => {
    clearPollTimer();
    if (!shouldContinuePolling(state)) {
      emptyPollCount = 0;
      return;
    }

    if (emptyPollCount >= MAX_EMPTY_POLL_ATTEMPTS) {
      return;
    }

    emptyPollCount += 1;
    pollTimer = setTimeout(() => {
      void fetchState('read');
    }, POLL_INTERVAL_MS);
  };

  const applyNewState = (state: DashboardState) => {
    hasReceivedState = true;
    dashboardError.set(null);
    dashboardState.set(state);
    schedulePollIfNeeded(state);
  };

  const callToolAndApply = async (
    name: string,
    args: Record<string, unknown>
  ): Promise<void> => {
    const result = await app.callServerTool({
      name,
      arguments: args
    });
    if (result?.isError) {
      const text =
        (result.content?.[0] as { text?: string } | undefined)?.text ??
        `Tool ${name} returned an error.`;
      throw new Error(text);
    }
    if (!isDashboardState(result?.structuredContent)) {
      throw new Error(`Unexpected response format from ${name}.`);
    }
    applyNewState(result.structuredContent);
  };

  const fetchState = async (mode: FetchMode): Promise<void> => {
    if (inFlight && mode === 'read') {
      return;
    }
    if (mode !== 'read') {
      clearPollTimer();
      emptyPollCount = 0;
      dashboardRefreshing.set(true);
    }

    inFlight = true;
    try {
      if (mode === 'read') {
        await callToolAndApply(entrypointTool, {});
      } else if (mode === 'refresh') {
        await callToolAndApply(entrypointTool, { refresh: true });
      } else if (mode === 'exportAll') {
        try {
          await callToolAndApply('app_export_all', {});
        } catch {
          await callToolAndApply(entrypointTool, { refresh: true });
        }
      } else {
        await callToolAndApply('app_reset_cache', {});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[TokenMonitorMcpApp] Action ${mode} failed:`, error);
      dashboardError.set(`加载数据失败 (${mode}): ${message}`);
    } finally {
      inFlight = false;
      if (mode !== 'read') {
        dashboardRefreshing.set(false);
      }
    }
  };

  // Register handlers BEFORE connect() so initial tool input/result/context are not missed.
  app.ontoolinput = () => {
    // Keep existing store if already hydrated; initial loading state renders automatically otherwise.
  };

  app.ontoolresult = (result) => {
    if (isDashboardState(result?.structuredContent)) {
      applyNewState(result.structuredContent);
      return;
    }
    void fetchState('read');
  };

  app.onhostcontextchanged = (ctx) => {
    applyMcpHostContext(ctx);
  };

  setHostMessageHandler((rawMessage) => {
    if (!rawMessage || typeof rawMessage !== 'object') {
      return;
    }
    const msg = rawMessage as { type?: string };
    switch (msg.type) {
      case 'dashboard/ready':
      case 'sidebar/ready':
        void fetchState('read');
        break;
      case 'dashboard/autoRefresh':
      case 'dashboard/refresh':
      case 'sidebar/refresh':
        void fetchState('refresh');
        break;
      case 'dashboard/exportAll':
        void fetchState('exportAll');
        break;
      case 'dashboard/resetCache':
        void fetchState('resetCache');
        break;
      case 'sidebar/openDashboard':
        void app.callServerTool({ name: 'open_token_dashboard', arguments: {} }).catch(() => {});
        break;
      case 'sidebar/openSession':
        void fetchState('read');
        break;
    }
  });

  try {
    await app.connect();
    applyMcpHostContext(app.getHostContext());

    // Wait briefly for host-pushed ontoolresult; if host opens a view without pushing result, fetch via entrypointTool.
    await new Promise((resolve) => setTimeout(resolve, INITIAL_FALLBACK_DELAY_MS));
    if (!hasReceivedState) {
      await fetchState('read');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[TokenMonitorMcpApp] Failed to connect MCP App host:', error);
    dashboardError.set(`无法连接到 MCP App 宿主: ${message}`);
  }

  return app;
}
