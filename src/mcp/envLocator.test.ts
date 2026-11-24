import { describe, expect, it, vi } from 'vitest';
import { detectEnvConnection, parseEnvAddress } from './envLocator';

describe('mcp/envLocator', () => {
  it('parses loopback addresses including IPv6 and rejects non-loopback hosts', () => {
    expect(parseEnvAddress('localhost:5387')).toEqual({
      hostname: 'localhost',
      port: 5387,
      protocol: undefined
    });
    expect(parseEnvAddress('http://127.0.0.1:5387/')).toEqual({
      hostname: '127.0.0.1',
      port: 5387,
      protocol: 'http'
    });
    expect(parseEnvAddress('https://[::1]:6443')).toEqual({
      hostname: '::1',
      port: 6443,
      protocol: 'https'
    });
    expect(parseEnvAddress('https://evil.example.com:5387')).toBeNull();
    expect(parseEnvAddress('')).toBeNull();
    expect(parseEnvAddress('localhost')).toBeNull();
    expect(parseEnvAddress('localhost:99999')).toBeNull();
  });

  it('returns null when ANTIGRAVITY_CSRF_TOKEN or ANTIGRAVITY_LS_ADDRESS is missing', async () => {
    const probe = vi.fn(async () => true);
    expect(await detectEnvConnection({}, probe)).toBeNull();
    expect(await detectEnvConnection({ ANTIGRAVITY_LS_ADDRESS: 'localhost:5387' }, probe)).toBeNull();
    expect(await detectEnvConnection({ ANTIGRAVITY_CSRF_TOKEN: 'secret' }, probe)).toBeNull();
    expect(probe).not.toHaveBeenCalled();
  });

  it('probes http then falls back to https when protocol is omitted', async () => {
    const probe = vi.fn(async (_h, _p, proto) => proto === 'https');
    const conn = await detectEnvConnection(
      {
        ANTIGRAVITY_LS_ADDRESS: '127.0.0.1:5387',
        ANTIGRAVITY_CSRF_TOKEN: 'tok-123'
      },
      probe
    );

    expect(probe).toHaveBeenCalledTimes(2);
    expect(conn).toEqual({
      pid: 0,
      hostname: '127.0.0.1',
      port: 5387,
      protocol: 'https',
      csrfToken: 'tok-123'
    });
  });

  it('uses explicit protocol without extra fallback probes', async () => {
    const probe = vi.fn(async () => true);
    const conn = await detectEnvConnection(
      {
        ANTIGRAVITY_LS_ADDRESS: 'http://localhost:5387',
        ANTIGRAVITY_CSRF_TOKEN: 'tok-abc'
      },
      probe
    );

    expect(probe).toHaveBeenCalledTimes(1);
    expect(conn).toEqual({
      pid: 0,
      hostname: 'localhost',
      port: 5387,
      protocol: 'http',
      csrfToken: 'tok-abc'
    });
  });
});
