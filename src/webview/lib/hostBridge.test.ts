import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchHostMessage, setHostMessageHandler } from './hostBridge';
import { vscodeApi } from './vscodeApi';

describe('webview/lib/hostBridge', () => {
  afterEach(() => {
    setHostMessageHandler(null);
    vi.restoreAllMocks();
  });

  it('returns false when no host handler is registered', () => {
    expect(dispatchHostMessage({ type: 'dashboard/refresh' })).toBe(false);
  });

  it('intercepts messages via vscodeApi when a custom handler is registered', () => {
    const handler = vi.fn();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    setHostMessageHandler(handler);

    vscodeApi.postMessage({ type: 'dashboard/refresh' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ type: 'dashboard/refresh' });
    expect(logSpy).not.toHaveBeenCalled();

    setHostMessageHandler(null);
    vscodeApi.postMessage({ type: 'dashboard/ready' });
    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
