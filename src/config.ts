import * as vscode from 'vscode';
import {
  createMonitorConfig,
  EXTENSION_ID,
  getDefaultSessionRoot,
  type MonitorConfig
} from './core/config';

export { EXTENSION_ID, getDefaultSessionRoot, type MonitorConfig };

export function readConfig(): MonitorConfig {
  const config = vscode.workspace.getConfiguration(EXTENSION_ID);
  return createMonitorConfig({
    sessionRoot: config.get<string>('sessionRoot'),
    debug: config.get<boolean>('debug', false),
    pollIntervalMs: config.get<number>('pollIntervalMs', 60000),
    historyLimit: config.get<number>('historyLimit', 120),
    maxFileBytes: config.get<number>('maxFileBytes', 50 * 1024 * 1024),
    useRpcExport: config.get<boolean>('useRpcExport', true),
    exportStepsJsonl: config.get<boolean>('exportStepsJsonl', false),
    rpcExportIntervalMs: config.get<number>('rpcExportIntervalMs', 300000),
    rpcTimeoutMs: config.get<number>('rpcTimeoutMs', 5000)
  });
}
