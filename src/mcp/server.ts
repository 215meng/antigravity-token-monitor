import * as fs from 'fs/promises';
import * as path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { getDefaultSessionRoot, loadStandaloneConfig } from '../core/config';
import type { MonitorLogger } from '../core/types';
import { SessionScanner } from '../monitor/sessionScanner';
import { SessionUsageCalculator } from '../monitor/sessionUsageCalculator';
import { TokenMonitorService } from '../monitor/tokenMonitorService';
import { AntigravitySessionParser } from '../parser/antigravitySessionParser';
import { SnapshotStore } from '../storage/snapshotStore';
import { dispatchMcpToolCall } from './toolHandlers';

const DASHBOARD_URI = 'ui://token-monitor/dashboard.html';
const SIDEBAR_URI = 'ui://token-monitor/sidebar.html';
const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';

function redirectConsoleToStderr(): void {
  const writeStderr = (level: string, args: unknown[]) => {
    const text = args
      .map((item) => (typeof item === 'string' ? item : JSON.stringify(item)))
      .join(' ');
    process.stderr.write(`[${level}] ${text}\n`);
  };
  console.log = (...args: unknown[]) => writeStderr('LOG', args);
  console.info = (...args: unknown[]) => writeStderr('INFO', args);
  console.warn = (...args: unknown[]) => writeStderr('WARN', args);
  console.debug = (...args: unknown[]) => writeStderr('DEBUG', args);
}

function parseDataDirArg(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--data-dir=')) {
      const value = arg.slice('--data-dir='.length).trim();
      if (value) return value;
    } else if (arg === '--data-dir' && argv[i + 1]) {
      return argv[i + 1].trim();
    }
  }
  return path.join(getDefaultSessionRoot(), '.token-monitor', 'plugin-data');
}

function createStderrLogger(): MonitorLogger {
  return {
    appendLine(value: string) {
      process.stderr.write(`${value}\n`);
    }
  };
}

async function readUiHtml(envVarName: string, defaultFileName: string, title: string): Promise<string> {
  const customPath = process.env[envVarName]?.trim();
  const candidates = customPath
    ? [customPath, path.join(__dirname, defaultFileName)]
    : [path.join(__dirname, defaultFileName)];

  for (const candidate of candidates) {
    try {
      const html = await fs.readFile(candidate, 'utf8');
      if (html.trim().length > 0) {
        return html;
      }
    } catch {
      // Fall through to next candidate or placeholder
    }
  }

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;padding:24px;"><h2>${title}</h2><p>UI bundle (${defaultFileName}) has not been built yet. Run <code>npm run build:plugin</code>.</p></body></html>`;
}

export async function startMcpServer(): Promise<void> {
  redirectConsoleToStderr();

  const dataDir = parseDataDirArg(process.argv.slice(2));
  const configPath = path.join(dataDir, 'config.json');
  const logger = createStderrLogger();

  const scanner = new SessionScanner();
  const calculator = new SessionUsageCalculator();
  const store = new SnapshotStore(dataDir);
  const service = new TokenMonitorService(
    () => loadStandaloneConfig(configPath),
    scanner,
    (config) => new AntigravitySessionParser(config.maxFileBytes),
    calculator,
    store,
    logger
  );

  // Load persisted snapshot state quickly without blocking MCP stdio handshake or first UI render on 500+ session scans.
  const initPromise = service
    .initialize({ skipInitialSync: true })
    .then(() => {
      const current = service.getDashboardState();
      if (current.sessions.length === 0) {
        void service
          .refresh({ skipExport: true, force: true })
          .then(() => service.exportNow({ force: false, refreshAfter: true }))
          .catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            process.stderr.write(`[TokenMonitorMCP] Cold-start sync failed: ${message}\n`);
          });
      } else {
        void service.exportNow({ force: false, refreshAfter: true }).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(`[TokenMonitorMCP] Background sync failed: ${message}\n`);
        });
      }
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`[TokenMonitorMCP] Background initialization failed: ${message}\n`);
    });

  const server = new Server(
    {
      name: 'antigravity-token-monitor',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: DASHBOARD_URI,
        name: 'Token Monitor Dashboard',
        description: 'Full-page interactive Antigravity token monitoring dashboard',
        mimeType: MCP_APP_MIME_TYPE,
        _meta: {
          ui: {
            prefersBorder: false
          }
        }
      },
      {
        uri: SIDEBAR_URI,
        name: 'Token Monitor Sidebar',
        description: 'Compact Antigravity token usage sidebar highlighting monthly and daily totals',
        mimeType: MCP_APP_MIME_TYPE,
        _meta: {
          ui: {
            prefersBorder: false
          }
        }
      }
    ]
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === DASHBOARD_URI) {
      const text = await readUiHtml('ATM_DASHBOARD_HTML', 'dashboard.html', 'Antigravity Token Monitor');
      return {
        contents: [
          {
            uri,
            mimeType: MCP_APP_MIME_TYPE,
            text,
            _meta: {
              ui: {
                prefersBorder: false
              }
            }
          }
        ]
      };
    }

    if (uri === SIDEBAR_URI) {
      const text = await readUiHtml('ATM_SIDEBAR_HTML', 'sidebar.html', 'Antigravity Token 用量');
      return {
        contents: [
          {
            uri,
            mimeType: MCP_APP_MIME_TYPE,
            text,
            _meta: {
              ui: {
                prefersBorder: false
              }
            }
          }
        ]
      };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'open_token_dashboard',
        title: 'TokenScope',
        description: 'Open the full-page Antigravity TokenScope observability dashboard showing monthly cumulative usage, today breakdown, heatmap, model distribution, cost estimate, and session list.',
        inputSchema: {
          type: 'object',
          properties: {
            refresh: {
              type: 'boolean',
              description: 'Optional. Refresh and export latest sessions before returning summary.'
            }
          }
        },
        _meta: {
          ui: {
            resourceUri: DASHBOARD_URI,
            visibility: ['model', 'app']
          },
          'com.google.antigravity/ui': {
            entrypoints: [
              { type: 'global', title: 'TokenScope' }
            ]
          }
        }
      },
      {
        name: 'open_token_sidebar',
        title: 'Token 用量',
        description: 'Open the compact Token Monitor sidebar in the auxiliary pane highlighting monthly cumulative and daily usage.',
        inputSchema: {
          type: 'object',
          properties: {
            refresh: {
              type: 'boolean',
              description: 'Optional. Refresh and export latest sessions before returning summary.'
            }
          }
        },
        _meta: {
          ui: {
            resourceUri: SIDEBAR_URI,
            visibility: ['model', 'app']
          },
          'com.google.antigravity/ui': {
            entrypoints: [
              { type: 'aux_pane', title: 'Token 用量' }
            ]
          }
        }
      },
      {
        name: 'get_token_usage_summary',
        title: 'Get Token Usage Summary',
        description: 'Query Antigravity token usage and estimated USD cost for today, current month, or all recorded sessions.',
        inputSchema: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              enum: ['today', 'month', 'all'],
              default: 'month',
              description: 'Aggregation window: today, current month (default), or all.'
            },
            refresh: {
              type: 'boolean',
              default: false,
              description: 'Whether to run an incremental scan/export before computing summary.'
            }
          }
        },
        _meta: {
          ui: {
            visibility: ['model']
          }
        }
      },
      {
        name: 'app_get_dashboard_state',
        title: 'Get Full Dashboard State',
        description: 'App-only tool returning complete DashboardState JSON.',
        inputSchema: { type: 'object', properties: {} },
        _meta: {
          ui: {
            visibility: ['app']
          }
        }
      },
      {
        name: 'app_refresh_now',
        title: 'Refresh Token Data',
        description: 'App-only tool triggering incremental scan and returning updated DashboardState.',
        inputSchema: { type: 'object', properties: {} },
        _meta: {
          ui: {
            visibility: ['app']
          }
        }
      },
      {
        name: 'app_export_all',
        title: 'Export All Sessions',
        description: 'App-only tool triggering full RPC trajectory export and returning updated DashboardState.',
        inputSchema: { type: 'object', properties: {} },
        _meta: {
          ui: {
            visibility: ['app']
          }
        }
      },
      {
        name: 'app_reset_cache',
        title: 'Reset Token Cache',
        description: 'App-only tool clearing RPC cache and rebuilding token index.',
        inputSchema: { type: 'object', properties: {} },
        _meta: {
          ui: {
            visibility: ['app']
          }
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    await initPromise;
    const toolName = request.params.name;
    if (
      toolName === 'open_token_dashboard' ||
      toolName === 'open_token_sidebar' ||
      toolName === 'app_get_dashboard_state'
    ) {
      const current = service.getDashboardState();
      if (
        current.syncStatus === 'idle' &&
        current.exportStatus.status === 'idle' &&
        current.sessions.length === 0 &&
        !current.lastPollAt
      ) {
        void service.exportNow({ force: false, refreshAfter: true }).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          process.stderr.write(`[TokenMonitorMCP] Deferred background sync failed: ${message}\n`);
        });
      }
    }
    return dispatchMcpToolCall(
      service,
      toolName,
      request.params.arguments as Record<string, unknown> | undefined
    );
  });

  const shutdown = async () => {
    service.dispose();
    await server.close().catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[TokenMonitorMCP] Server started (dataDir=${dataDir})\n`);
}

if (require.main === module) {
  startMcpServer().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`[TokenMonitorMCP] Fatal error: ${message}\n`);
    process.exit(1);
  });
}
