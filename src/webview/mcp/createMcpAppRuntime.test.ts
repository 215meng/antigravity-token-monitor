import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { dashboardError, dashboardState } from '../lib/dashboardStore';
import { dispatchHostMessage, setHostMessageHandler } from '../lib/hostBridge';
import { mockDashboardState } from '../test/fixtures/dashboardState.fixture';

const calls: Array<{ name: string; arguments?: Record<string, unknown> }> = [];
let mockAppInstance: {
  ontoolinput?: (params: unknown) => void;
  ontoolresult?: (result: { structuredContent?: unknown }) => void;
  onhostcontextchanged?: (ctx: unknown) => void;
  connect: ReturnType<typeof vi.fn>;
  getHostContext: ReturnType<typeof vi.fn>;
  callServerTool: ReturnType<typeof vi.fn>;
};

vi.mock('@modelcontextprotocol/ext-apps', () => {
  return {
    App: class MockApp {
      ontoolinput?: (params: unknown) => void;
      ontoolresult?: (result: { structuredContent?: unknown }) => void;
      onhostcontextchanged?: (ctx: unknown) => void;
      connect = vi.fn(async () => {});
      getHostContext = vi.fn(() => ({ theme: 'dark' }));
      callServerTool = vi.fn(async (params: { name: string; arguments?: Record<string, unknown> }) => {
        calls.push(params);
        if (params.name === 'app_get_dashboard_state') {
          throw new Error('permission_denied: tool "app_get_dashboard_state" is disabled');
        }
        return {
          content: [{ type: 'text', text: 'ok' }],
          structuredContent: mockDashboardState
        };
      });

      constructor() {
        mockAppInstance = this;
      }
    },
    applyDocumentTheme: vi.fn(),
    applyHostFonts: vi.fn(),
    applyHostStyleVariables: vi.fn()
  };
});

import { initMcpAppRuntime } from './createMcpAppRuntime';

describe('webview/mcp/createMcpAppRuntime', () => {
  beforeEach(() => {
    calls.length = 0;
    dashboardState.set(null);
    dashboardError.set(null);
    setHostMessageHandler(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setHostMessageHandler(null);
  });

  it('hydrates immediately from ontoolresult without ever calling app_get_dashboard_state', async () => {
    const runtimePromise = initMcpAppRuntime('dashboard');
    mockAppInstance.ontoolresult?.({ structuredContent: mockDashboardState });
    await runtimePromise;

    expect(get(dashboardState)?.summary.totalTokens).toBe(600);
    expect(get(dashboardError)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('falls back to open_token_dashboard / open_token_sidebar and routes refresh via entrypoint tool', async () => {
    await initMcpAppRuntime('sidebar');

    expect(calls.map((c) => c.name)).toEqual(['open_token_sidebar']);
    expect(get(dashboardState)?.summary.totalTokens).toBe(600);
    expect(get(dashboardError)).toBeNull();

    dispatchHostMessage({ type: 'sidebar/refresh' });
    await new Promise((r) => setTimeout(r, 10));

    expect(calls).toEqual([
      { name: 'open_token_sidebar', arguments: {} },
      { name: 'open_token_sidebar', arguments: { refresh: true } }
    ]);
    expect(calls.some((c) => c.name === 'app_get_dashboard_state')).toBe(false);
  });
});
