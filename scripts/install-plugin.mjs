import * as fs from 'fs/promises';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'dist', 'antigravity-plugin');

const PLUGIN_DIR_NAME = 'antigravity-token-monitor';
const MCP_SERVER_NAMESPACE = 'antigravity-token-monitor_token-monitor';

function parseArgs(argv) {
  let targetDir = path.join(os.homedir(), '.gemini', 'config', 'plugins', PLUGIN_DIR_NAME);
  let dryRun = false;

  for (const arg of argv) {
    if (arg.startsWith('--target=')) {
      targetDir = path.resolve(arg.slice('--target='.length));
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  return { targetDir, dryRun };
}

async function copyFileSafe(srcPath, destPath) {
  try {
    await fs.copyFile(srcPath, destPath);
  } catch (error) {
    if (error && (error.code === 'EBUSY' || error.code === 'EPERM')) {
      const backupPath = `${destPath}.old.${Date.now()}`;
      await fs.rename(destPath, backupPath).catch(() => {});
      await fs.copyFile(srcPath, destPath);
      await fs.unlink(backupPath).catch(() => {});
      return;
    }
    throw error;
  }
}

async function copyDirRecursive(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await copyFileSafe(srcPath, destPath);
    }
  }
}

async function tryRefreshMcpServer() {
  const csrfToken = process.env.ANTIGRAVITY_CSRF_TOKEN?.trim();
  if (!csrfToken) {
    return;
  }

  const lsAddress = process.env.ANTIGRAVITY_LS_ADDRESS?.trim() || 'localhost:5387';
  const isHttps = lsAddress.startsWith('https://');
  const transport = isHttps ? https : http;
  const cleanHostPort = lsAddress.replace(/^https?:\/\//, '').split('/')[0];
  const lastColon = cleanHostPort.lastIndexOf(':');
  if (lastColon <= 0) {
    return;
  }
  let hostname = cleanHostPort.slice(0, lastColon);
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  const port = Number(cleanHostPort.slice(lastColon + 1));
  if (!Number.isInteger(port)) {
    return;
  }

  const payload = JSON.stringify({ serverName: MCP_SERVER_NAMESPACE });
  await new Promise((resolve) => {
    const req = transport.request(
      {
        hostname,
        port,
        path: '/exa.language_server_pb.LanguageServerService/RefreshMcpServers',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-codeium-csrf-token': csrfToken
        },
        ...(isHttps ? { rejectUnauthorized: false } : {}),
        timeout: 3000
      },
      (res) => {
        res.resume();
        if (res.statusCode === 200) {
          console.log(`[install-plugin] Refreshed MCP server "${MCP_SERVER_NAMESPACE}" in running Antigravity.`);
        } else {
          console.log(`[install-plugin] RefreshMcpServers returned HTTP ${res.statusCode} (non-fatal).`);
        }
        resolve();
      }
    );

    req.on('error', () => resolve());
    req.on('timeout', () => {
      req.destroy();
      resolve();
    });
    req.write(payload);
    req.end();
  });
}

async function run() {
  const { targetDir, dryRun } = parseArgs(process.argv.slice(2));
  const manifestPath = path.join(sourceDir, 'plugin.json');

  try {
    await fs.access(manifestPath);
  } catch {
    console.error(`[install-plugin] Built plugin not found at ${sourceDir}. Run "npm run build:plugin" first.`);
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[install-plugin] Dry run: would install ${sourceDir} -> ${targetDir}`);
    return;
  }

  await copyDirRecursive(sourceDir, targetDir);
  const binDir = path.join(targetDir, 'bin');
  const binEntries = await fs.readdir(binDir).catch(() => []);
  for (const name of binEntries) {
    if (name.includes('.old.') || name.endsWith('.map')) {
      await fs.unlink(path.join(binDir, name)).catch(() => {});
    }
  }
  console.log(`[install-plugin] Installed Antigravity plugin to: ${targetDir}`);

  const legacySkillDir = path.join(os.homedir(), '.gemini', 'config', 'skills', 'token-monitor');
  try {
    await fs.access(legacySkillDir);
    console.log(
      `[install-plugin] Note: Legacy standalone skill detected at ${legacySkillDir}. You may remove it after verifying the plugin to avoid duplicate triggers.`
    );
  } catch {
    // No legacy standalone skill present
  }

  await tryRefreshMcpServer();
}

run().catch((error) => {
  console.error('[install-plugin] Failed:', error);
  process.exit(1);
});
