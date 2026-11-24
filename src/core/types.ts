export interface MonitorLogger {
  appendLine(value: string): void;
}

export interface MonitorDisposable {
  dispose(): void;
}

export const noopLogger: MonitorLogger = {
  appendLine() {}
};
