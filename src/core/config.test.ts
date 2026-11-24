import * as fs from 'fs/promises';
import { mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMonitorConfig,
  getDefaultSessionRoot,
  loadStandaloneConfig,
  validateTimeConfig
} from './config';

describe('core/config', () => {
  const originalEnv = process.env.ATM_SESSION_ROOT;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env.ATM_SESSION_ROOT;
    } else {
      process.env.ATM_SESSION_ROOT = originalEnv;
    }
  });

  it('creates default MonitorConfig without vscode runtime', () => {
    const config = createMonitorConfig();
    expect(config.sessionRoot).toBe(getDefaultSessionRoot());
    expect(config.pollIntervalMs).toBe(60000);
    expect(config.historyLimit).toBe(120);
    expect(config.maxFileBytes).toBe(50 * 1024 * 1024);
    expect(config.useRpcExport).toBe(true);
    expect(config.exportStepsJsonl).toBe(false);
    expect(config.rpcExportIntervalMs).toBe(300000);
    expect(config.rpcTimeoutMs).toBe(5000);
  });

  it('migrates legacy 524288 maxFileBytes to 50MB and clamps time configs', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const config = createMonitorConfig({
      sessionRoot: '  /custom/root  ',
      maxFileBytes: 524288,
      pollIntervalMs: 100,
      rpcTimeoutMs: 999_999
    });

    expect(config.sessionRoot).toBe('/custom/root');
    expect(config.maxFileBytes).toBe(50 * 1024 * 1024);
    expect(config.pollIntervalMs).toBe(1000);
    expect(config.rpcTimeoutMs).toBe(600_000);
    expect(validateTimeConfig('invalid', Number.NaN, 5000)).toBe(1000);
  });

  it('loads standalone JSON config and falls back gracefully when missing', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'antigravity-config-'));
    const configPath = path.join(dir, 'config.json');
    await fs.writeFile(configPath, JSON.stringify({
      debug: true,
      pollIntervalMs: 30000,
      historyLimit: 60
    }), 'utf8');

    const loaded = loadStandaloneConfig(configPath, { rpcTimeoutMs: 8000 });
    expect(loaded.debug).toBe(true);
    expect(loaded.pollIntervalMs).toBe(30000);
    expect(loaded.historyLimit).toBe(60);
    expect(loaded.rpcTimeoutMs).toBe(8000);

    const missing = loadStandaloneConfig(path.join(dir, 'missing.json'));
    expect(missing.pollIntervalMs).toBe(60000);
  });
});
