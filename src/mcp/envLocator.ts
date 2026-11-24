import * as http from 'http';
import * as https from 'https';
import type { RpcConnectionInfo } from '../rpc/processLocator';

export type ParsedEnvAddress = {
  hostname: string;
  port: number;
  protocol?: 'http' | 'https';
};

export type EnvProbeFn = (
  hostname: string,
  port: number,
  protocol: 'http' | 'https',
  csrfToken: string
) => Promise<boolean>;

export function parseEnvAddress(raw?: string): ParsedEnvAddress | null {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return null;
  }

  let protocol: 'http' | 'https' | undefined;
  let hostPort = trimmed;

  if (trimmed.startsWith('http://')) {
    protocol = 'http';
    hostPort = trimmed.slice('http://'.length);
  } else if (trimmed.startsWith('https://')) {
    protocol = 'https';
    hostPort = trimmed.slice('https://'.length);
  }

  // Strip optional trailing path
  const slashIdx = hostPort.indexOf('/');
  if (slashIdx !== -1) {
    hostPort = hostPort.slice(0, slashIdx);
  }

  const lastColon = hostPort.lastIndexOf(':');
  if (lastColon <= 0) {
    return null;
  }

  let hostname = hostPort.slice(0, lastColon).trim();
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  const portStr = hostPort.slice(lastColon + 1).trim();
  const port = Number(portStr);

  const isLoopback = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
  if (!isLoopback || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return null;
  }

  return { hostname, port, protocol };
}

export async function defaultProbeEnvConnection(
  hostname: string,
  port: number,
  protocol: 'http' | 'https',
  csrfToken: string
): Promise<boolean> {
  const body = JSON.stringify({});
  const transport = protocol === 'http' ? http : https;

  return new Promise((resolve) => {
    const req = transport.request(
      {
        hostname,
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': csrfToken
        },
        ...(protocol === 'https' ? { rejectUnauthorized: false } : {}),
        timeout: 1500
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.write(body);
    req.end();
  });
}

export async function detectEnvConnection(
  env: NodeJS.ProcessEnv = process.env,
  probeFn: EnvProbeFn = defaultProbeEnvConnection,
  log?: (message: string) => void
): Promise<RpcConnectionInfo | null> {
  const csrfToken = env.ANTIGRAVITY_CSRF_TOKEN?.trim();
  if (!csrfToken) {
    return null;
  }

  const parsed = parseEnvAddress(env.ANTIGRAVITY_LS_ADDRESS);
  if (!parsed) {
    return null;
  }

  const protocols: Array<'http' | 'https'> = parsed.protocol
    ? [parsed.protocol]
    : ['http', 'https'];

  for (const protocol of protocols) {
    const ok = await probeFn(parsed.hostname, parsed.port, protocol, csrfToken);
    log?.(`EnvLocator: probe ${protocol}://${parsed.hostname}:${parsed.port} -> ${ok ? 'ok' : 'failed'}`);
    if (ok) {
      return {
        pid: 0,
        hostname: parsed.hostname,
        port: parsed.port,
        protocol,
        csrfToken
      };
    }
  }

  return null;
}
