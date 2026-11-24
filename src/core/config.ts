import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export const EXTENSION_ID = 'antigravity-token-monitor';

export type MonitorConfig = {
  sessionRoot: string;
  debug: boolean;
  pollIntervalMs: number;
  historyLimit: number;
  maxFileBytes: number;
  useRpcExport: boolean;
  exportStepsJsonl: boolean;
  rpcExportIntervalMs: number;
  rpcTimeoutMs: number;
};

export function getDefaultSessionRoot(): string {
  return path.join(os.homedir(), '.gemini', 'antigravity');
}

/**
 * Validates time-based configuration values (intervals and timeouts).
 * Clamps values to a safe range and warns on out-of-bounds input.
 */
export function validateTimeConfig(name: string, value: number, defaultValue: number): number {
  const MIN_MS = 1000;
  const MAX_MS = 600_000;
  const num = value === undefined ? defaultValue : Number(value);
  if (!Number.isFinite(num) || num < MIN_MS) {
    console.warn(`[Config] ${name}=${value} is invalid or too low (<${MIN_MS}ms), using ${MIN_MS}ms.`);
    return MIN_MS;
  }
  if (num > MAX_MS) {
    console.warn(`[Config] ${name}=${value} is too high (>-${MAX_MS}ms), using ${MAX_MS}ms.`);
    return MAX_MS;
  }
  return num;
}

export function createMonitorConfig(overrides: Partial<MonitorConfig> = {}): MonitorConfig {
  const sessionRoot = overrides.sessionRoot?.trim() || getDefaultSessionRoot();
  const configuredMaxFileBytes = overrides.maxFileBytes ?? 50 * 1024 * 1024;
  const maxFileBytes = configuredMaxFileBytes === 524288 ? 50 * 1024 * 1024 : configuredMaxFileBytes;

  return {
    sessionRoot,
    debug: overrides.debug ?? false,
    pollIntervalMs: validateTimeConfig('pollIntervalMs', overrides.pollIntervalMs ?? 60000, 60000),
    historyLimit: overrides.historyLimit ?? 120,
    maxFileBytes,
    useRpcExport: overrides.useRpcExport ?? true,
    exportStepsJsonl: overrides.exportStepsJsonl ?? false,
    rpcExportIntervalMs: validateTimeConfig('rpcExportIntervalMs', overrides.rpcExportIntervalMs ?? 300000, 300000),
    rpcTimeoutMs: validateTimeConfig('rpcTimeoutMs', overrides.rpcTimeoutMs ?? 5000, 5000)
  };
}

export function loadStandaloneConfig(configPath?: string, overrides: Partial<MonitorConfig> = {}): MonitorConfig {
  let fileConfig: Partial<MonitorConfig> = {};

  if (configPath) {
    try {
      const raw = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<MonitorConfig>;
      if (parsed && typeof parsed === 'object') {
        fileConfig = parsed;
      }
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn(`[Config] Failed to load standalone config from ${configPath}:`, error);
      }
    }
  }

  const envSessionRoot = process.env.ATM_SESSION_ROOT?.trim();
  const merged: Partial<MonitorConfig> = {
    ...fileConfig,
    ...(envSessionRoot ? { sessionRoot: envSessionRoot } : {}),
    ...overrides
  };

  return createMonitorConfig(merged);
}
