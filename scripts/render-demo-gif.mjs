import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const BUNDLE_BIN_DIR = path.join(ROOT_DIR, 'dist', 'antigravity-plugin', 'bin');
const DOCS_DIR = path.join(ROOT_DIR, 'docs');

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 720;
const FPS = 12;

function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDemoDashboardState(extraTodayTokens = 0) {
  const now = new Date();
  const nowMs = now.getTime();
  const heatmap = [];

  for (let offset = 165; offset >= 0; offset--) {
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const key = formatLocalDate(dt);
    const dow = dt.getDay();

    // Deterministic rich pattern covering all 10 heatmap gradient levels
    const wave = Math.sin((180 - offset) * 0.23) * 0.5 + 0.5;
    const weekendFactor = dow === 0 || dow === 6 ? 0.25 : 1.0;
    const recentBoost = offset < 28 ? 1.45 : offset < 65 ? 1.15 : 0.75;
    const isZero = offset > 4 && ((offset * 17 + dow * 3) % 13 === 0);

    let total = 0;
    if (!isZero) {
      const base = (1_800_000 + wave * 34_000_000) * weekendFactor * recentBoost;
      const spike = offset === 2 || offset === 9 || offset === 18 || offset === 33 ? 2.1 : 1.0;
      total = Math.round(base * spike);
    }
    if (offset === 0) {
      total = 26_480_000 + extraTodayTokens;
    }

    const inputTokens = Math.round(total * 0.14);
    const outputTokens = Math.round(total * 0.032);
    const reasoningTokens = Math.round(total * 0.018);
    const cacheReadTokens = Math.max(0, total - inputTokens - outputTokens - reasoningTokens);
    const msgCount = total > 0 ? Math.max(4, Math.round(total / 210_000)) : 0;
    const sessionCount = total > 0 ? Math.max(1, Math.min(18, Math.round(total / 2_800_000))) : 0;
    const costUsd = Number(((inputTokens * 1.2 + outputTokens * 8 + reasoningTokens * 8 + cacheReadTokens * 0.15) / 1_000_000).toFixed(4));

    heatmap.push({
      date: key,
      totalTokens: total,
      sessionCount,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens: 0,
      reasoningTokens,
      costUsd,
      messageCount: msgCount
    });
  }

  const demoSessions = [
    {
      sessionId: 'demo-inc-dedup-engine',
      label: 'Incremental Dedup Index & Cache Pipeline',
      total: 42_680_000 + extraTodayTokens,
      delta: extraTodayTokens > 0 ? extraTodayTokens : 18_420,
      msg: 148,
      status: 'active',
      minsAgo: 1
    },
    {
      sessionId: 'demo-optical-ui-system',
      label: 'Optical Glass Design System & Dual-Theme UI',
      total: 31_920_000,
      delta: 6_240,
      msg: 112,
      status: 'active',
      minsAgo: 8
    },
    {
      sessionId: 'demo-sqlite-trajectory',
      label: 'Native node:sqlite Trajectory Reader',
      total: 24_510_000,
      delta: 0,
      msg: 94,
      status: 'active',
      minsAgo: 26
    },
    {
      sessionId: 'demo-heatmap-10step',
      label: '10-Step Progressive Heatmap Quantizer',
      total: 18_340_000,
      delta: 0,
      msg: 68,
      status: 'active',
      minsAgo: 54
    },
    {
      sessionId: 'demo-i18n-runtime',
      label: 'Bilingual Runtime Store & MCP App Host',
      total: 12_890_000,
      delta: 0,
      msg: 49,
      status: 'active',
      minsAgo: 120
    },
    {
      sessionId: 'demo-vitest-suite',
      label: 'Cross-Session Equivalence Test Suite',
      total: 9_640_000,
      delta: 0,
      msg: 37,
      status: 'archived',
      minsAgo: 420
    }
  ].map((item) => {
    const input = Math.round(item.total * 0.14);
    const output = Math.round(item.total * 0.032);
    const reasoning = Math.round(item.total * 0.018);
    const cacheRead = Math.max(0, item.total - input - output - reasoning);
    return {
      sessionId: item.sessionId,
      label: item.label,
      filePath: `~/.gemini/antigravity/brain/${item.sessionId}`,
      lastModifiedMs: nowMs - item.minsAgo * 60_000,
      status: item.status,
      lastSeenAt: nowMs - item.minsAgo * 60_000,
      mode: 'reported',
      source: 'rpc-artifact',
      messageCount: item.msg,
      latest: {
        inputTokens: input,
        outputTokens: output,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: 0,
        reasoningTokens: reasoning,
        totalTokens: item.total
      },
      latestDelta: {
        inputTokens: Math.round(item.delta * 0.2),
        outputTokens: Math.round(item.delta * 0.1),
        cacheReadTokens: Math.round(item.delta * 0.7),
        cacheWriteTokens: 0,
        reasoningTokens: 0,
        totalTokens: item.delta
      },
      recentTotals: [
        Math.round(item.total * 0.25),
        Math.round(item.total * 0.42),
        Math.round(item.total * 0.68),
        Math.round(item.total * 0.85),
        item.total
      ],
      snapshotCount: 14
    };
  });

  const totalTokens = heatmap.reduce((s, d) => s + d.totalTokens, 0);
  const totalCost = Number(heatmap.reduce((s, d) => s + d.costUsd, 0).toFixed(2));
  const totalMsgs = heatmap.reduce((s, d) => s + d.messageCount, 0);

  return {
    rootPath: '~/.gemini/antigravity',
    config: {
      useRpcExport: true,
      exportStepsJsonl: false,
      pollIntervalMs: 60000
    },
    lastPollAt: nowMs - (extraTodayTokens > 0 ? 500 : 14_000),
    syncStatus: 'idle',
    syncMessage: 'Incremental Ready',
    exportStatus: {
      status: 'idle',
      message: 'Incremental index up to date',
      lastExportAt: nowMs - 18_000,
      lastExportedCount: extraTodayTokens > 0 ? 1 : 0
    },
    sessions: demoSessions,
    summary: {
      sessionCount: 783,
      activeSessionCount: 512,
      archivedSessionCount: 271,
      messageCount: totalMsgs,
      changedSessionCount: extraTodayTokens > 0 ? 2 : 1,
      totalTokens,
      estimatedSessionCount: 0
    },
    pricing: {
      status: 'ready',
      totalCostUsd: totalCost,
      pricedModelCount: 5,
      unpricedModelCount: 0,
      missingModels: [],
      lastUpdatedAt: nowMs,
      message: 'LiteLLM Catalog Synced'
    },
    analytics: {
      activityHeatmap: heatmap,
      sourceBreakdown: [
        { source: 'rpc-artifact', sessionCount: 783, changedSessionCount: 2, totalTokens }
      ],
      modeBreakdown: [
        { mode: 'reported', sessionCount: 783, changedSessionCount: 2, totalTokens }
      ],
      modelUsage: [
        { model: 'gemini-3.8-flash', totalTokens: Math.round(totalTokens * 0.56), sessionCount: 420, costUsd: Number((totalCost * 0.42).toFixed(2)), pricingStatus: 'priced' },
        { model: 'gemini-4-hydrogen', totalTokens: Math.round(totalTokens * 0.24), sessionCount: 215, costUsd: Number((totalCost * 0.28).toFixed(2)), pricingStatus: 'priced' },
        { model: 'gemini-4-neon', totalTokens: Math.round(totalTokens * 0.11), sessionCount: 92, costUsd: Number((totalCost * 0.19).toFixed(2)), pricingStatus: 'priced' },
        { model: 'claude-4.6-sonnet', totalTokens: Math.round(totalTokens * 0.06), sessionCount: 38, costUsd: Number((totalCost * 0.09).toFixed(2)), pricingStatus: 'priced' },
        { model: 'gpt-oss-120b', totalTokens: Math.round(totalTokens * 0.03), sessionCount: 18, costUsd: Number((totalCost * 0.02).toFixed(2)), pricingStatus: 'priced' }
      ],
      rpcCoverage: {
        trackedSessions: 783,
        exportedSessions: 783,
        skippedSessions: 0,
        changedSessions: extraTodayTokens > 0 ? 2 : 1
      }
    }
  };
}

function buildStageHtml() {
  const initialStateJson = JSON.stringify(buildDemoDashboardState(0));
  const refreshedStateJson = JSON.stringify(buildDemoDashboardState(12_480_000));

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${VIEW_WIDTH}px;
    height: ${VIEW_HEIGHT}px;
    overflow: hidden;
    background: #04080c;
    color: #e2f1ec;
    font-family: "Segoe UI", "Inter", system-ui, sans-serif;
  }
  .stage {
    position: relative;
    width: ${VIEW_WIDTH}px;
    height: ${VIEW_HEIGHT}px;
    overflow: hidden;
    background:
      radial-gradient(ellipse 75% 55% at 22% 0%, rgba(56, 189, 248, 0.14), transparent 60%),
      radial-gradient(ellipse 65% 50% at 88% 95%, rgba(94, 234, 212, 0.12), transparent 60%),
      #04080c;
  }
  .grid-overlay {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(94, 234, 212, 0.045) 1px, transparent 1px),
      linear-gradient(90deg, rgba(94, 234, 212, 0.045) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
  }
  .hud-topbar {
    position: relative;
    z-index: 20;
    height: 40px;
    padding: 0 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(94, 234, 212, 0.18);
    background: rgba(6, 12, 17, 0.88);
  }
  .hud-left {
    display: flex;
    align-items: center;
    gap: 10px;
    font-family: "Consolas", monospace;
    font-size: 11px;
    letter-spacing: 0.12em;
    color: #5eead4;
    font-weight: 700;
  }
  .hud-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #38bdf8;
    box-shadow: 0 0 10px #38bdf8;
  }
  .hud-scene {
    font-family: "Consolas", monospace;
    font-size: 11px;
    letter-spacing: 0.1em;
    padding: 3px 12px;
    border-radius: 999px;
    border: 1px solid rgba(56, 189, 248, 0.35);
    background: rgba(56, 189, 248, 0.1);
    color: #bae6fd;
  }
  .hud-right {
    font-family: "Consolas", monospace;
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: #7dd3fc;
    opacity: 0.85;
  }
  .viewport-area {
    position: relative;
    z-index: 10;
    width: ${VIEW_WIDTH}px;
    height: ${VIEW_HEIGHT - 68}px;
    padding: 12px 18px;
    display: flex;
    gap: 14px;
    align-items: stretch;
  }
  .frame-shell {
    position: relative;
    border-radius: 14px;
    border: 1px solid rgba(94, 234, 212, 0.24);
    background: #0b1012;
    box-shadow:
      0 18px 50px rgba(0, 0, 0, 0.65),
      0 0 28px rgba(56, 189, 248, 0.12),
      inset 0 1px 0 rgba(167, 243, 208, 0.18);
    overflow: hidden;
    transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .dash-shell {
    width: 1244px;
    height: 628px;
    flex-shrink: 0;
  }
  .stage.dual-pane .dash-shell {
    width: 906px;
  }
  .side-shell {
    width: 0;
    height: 628px;
    opacity: 0;
    flex-shrink: 0;
    transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease;
  }
  .stage.dual-pane .side-shell {
    width: 324px;
    opacity: 1;
  }
  iframe {
    border: none;
    display: block;
    background: #0b1012;
  }
  #dashFrame {
    width: 1460px;
    height: 740px;
    transform-origin: top left;
    transform: scale(0.852);
    transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .stage.dual-pane #dashFrame {
    width: 1180px;
    height: 818px;
    transform: scale(0.768);
  }
  #sideFrame {
    width: 344px;
    height: 668px;
    transform-origin: top left;
    transform: scale(0.94);
  }
  .hud-bottom {
    position: relative;
    z-index: 20;
    height: 28px;
    padding: 0 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: "Consolas", monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: #64748b;
    border-top: 1px solid rgba(94, 234, 212, 0.12);
    background: rgba(5, 10, 14, 0.92);
  }
  .hud-bottom strong { color: #5eead4; font-weight: 600; }
  .scan-line {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    top: -10px;
    z-index: 35;
    pointer-events: none;
    background: linear-gradient(90deg, transparent, rgba(56, 189, 248, 0.85), rgba(94, 234, 212, 0.95), transparent);
    box-shadow: 0 0 18px rgba(56, 189, 248, 0.65);
    opacity: 0;
  }
  .cursor-ring {
    position: fixed;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 2px solid #5eead4;
    background: rgba(56, 189, 248, 0.22);
    box-shadow: 0 0 16px rgba(94, 234, 212, 0.75);
    transform: translate(-50%, -50%) scale(1);
    z-index: 9999;
    pointer-events: none;
    opacity: 0;
    transition: transform 0.14s ease, opacity 0.2s ease;
  }
  .cursor-ring.clicking {
    transform: translate(-50%, -50%) scale(0.7);
    background: rgba(94, 234, 212, 0.65);
  }
</style>
</head>
<body>
  <div id="stage" class="stage">
    <div class="grid-overlay"></div>
    <div id="scanLine" class="scan-line"></div>
    <header class="hud-topbar">
      <div class="hud-left">
        <span class="hud-dot"></span>
        <span>ANTIGRAVITY TOKENSCOPE // NATIVE MCP APP</span>
      </div>
      <div id="hudScene" class="hud-scene">01 // OPTICAL TELEMETRY</div>
      <div class="hud-right">ZERO-INTRUSION · 4-LAYER INCREMENTAL · ZH / EN</div>
    </header>
    <main class="viewport-area">
      <div class="frame-shell dash-shell">
        <iframe id="dashFrame" src="/dashboard.html"></iframe>
      </div>
      <div class="frame-shell side-shell">
        <iframe id="sideFrame" src="/sidebar.html"></iframe>
      </div>
    </main>
    <footer class="hud-bottom">
      <span><strong>ENGINE</strong> 783 SESSIONS · 0.007ms WARM READ · 101ms DELTA DEDUP</span>
      <span><strong>PROTOCOL</strong> SEP-1865 MCP APP · LOCALHOST ONLY · MIT</span>
    </footer>
    <div id="cursorRing" class="cursor-ring"></div>
  </div>
  <script>
    const INITIAL_STATE = ${initialStateJson};
    const REFRESHED_STATE = ${refreshedStateJson};
    let activeState = INITIAL_STATE;

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') return;
      const target = event.source;
      if (!target) return;

      if (msg.method === 'ui/initialize' && msg.id !== undefined) {
        target.postMessage({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: '2026-01-26',
            hostInfo: { name: 'Antigravity', version: '2.0.0' },
            hostCapabilities: { serverTools: {} },
            hostContext: { theme: 'dark' }
          }
        }, '*');
        return;
      }

      if (msg.method === 'ui/notifications/initialized') {
        target.postMessage({
          jsonrpc: '2.0',
          method: 'ui/notifications/host-context-changed',
          params: { theme: 'dark' }
        }, '*');
        target.postMessage({
          jsonrpc: '2.0',
          method: 'ui/notifications/tool-result',
          params: {
            content: [{ type: 'text', text: 'ok' }],
            structuredContent: activeState
          }
        }, '*');
        return;
      }

      if (msg.method === 'tools/call' && msg.id !== undefined) {
        const isRefresh = Boolean(msg.params && msg.params.arguments && msg.params.arguments.refresh);
        const delayMs = isRefresh ? 420 : 20;
        if (isRefresh) {
          activeState = REFRESHED_STATE;
        }
        setTimeout(() => {
          target.postMessage({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              content: [{ type: 'text', text: 'ok' }],
              structuredContent: activeState
            }
          }, '*');
          if (isRefresh) {
            const sideWin = document.getElementById('sideFrame').contentWindow;
            if (sideWin) {
              sideWin.postMessage({
                jsonrpc: '2.0',
                method: 'ui/notifications/tool-result',
                params: {
                  content: [{ type: 'text', text: 'ok' }],
                  structuredContent: activeState
                }
              }, '*');
            }
          }
        }, delayMs);
      }
    });

    window.__demoApi = {
      setScene(label, dualPane) {
        document.getElementById('hudScene').textContent = label;
        const stage = document.getElementById('stage');
        if (dualPane) stage.classList.add('dual-pane');
        else stage.classList.remove('dual-pane');
      },
      setScanY(y, opacity) {
        const line = document.getElementById('scanLine');
        line.style.top = y + 'px';
        line.style.opacity = String(opacity);
      },
      setCursor(x, y, visible, clicking) {
        const c = document.getElementById('cursorRing');
        c.style.left = x + 'px';
        c.style.top = y + 'px';
        c.style.opacity = visible ? '1' : '0';
        if (clicking) c.classList.add('clicking');
        else c.classList.remove('clicking');
      },
      getDashTargetPos(selector, nth = 0) {
        const frame = document.getElementById('dashFrame');
        const doc = frame.contentDocument;
        if (!doc) return null;
        const list = doc.querySelectorAll(selector);
        const el = list[nth];
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const fr = frame.getBoundingClientRect();
        const scale = fr.width / frame.offsetWidth;
        return {
          x: fr.left + (r.left + r.width / 2) * scale,
          y: fr.top + (r.top + r.height / 2) * scale
        };
      },
      triggerDashHover(selector, nth = 0) {
        const frame = document.getElementById('dashFrame');
        const doc = frame.contentDocument;
        const el = doc && doc.querySelectorAll(selector)[nth];
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        return true;
      },
      triggerDashLeave(selector, nth = 0) {
        const frame = document.getElementById('dashFrame');
        const doc = frame.contentDocument;
        const el = doc && doc.querySelectorAll(selector)[nth];
        if (!el) return false;
        el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
        return true;
      },
      clickDash(selector) {
        const frame = document.getElementById('dashFrame');
        const doc = frame.contentDocument;
        const el = doc && doc.querySelector(selector);
        if (!el) return false;
        el.click();
        return true;
      },
      isReady() {
        const dDoc = document.getElementById('dashFrame').contentDocument;
        const sDoc = document.getElementById('sideFrame').contentDocument;
        return Boolean(
          dDoc && dDoc.querySelector('.hero-dual-grid') && dDoc.querySelectorAll('.heatmap-cell').length > 20 &&
          sDoc && sDoc.querySelector('.dual-focal-grid')
        );
      }
    };
  </script>
</body>
</html>`;
}

function findBrowserExecutable() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const exe of candidates) {
    if (fs.existsSync(exe)) {
      return exe;
    }
  }
  throw new Error('Neither Chrome nor Edge executable was found.');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startLocalServer(dashHtml, sideHtml, stageHtml) {
  const server = http.createServer((req, res) => {
    const reqUrl = (req.url || '/').split('?')[0];
    if (reqUrl === '/' || reqUrl === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(stageHtml);
      return;
    }
    if (reqUrl === '/dashboard.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(dashHtml);
      return;
    }
    if (reqUrl === '/sidebar.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(sideHtml);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { server, url: `http://127.0.0.1:${address.port}/` };
}

async function launchHeadlessChrome(exePath, profileDir) {
  const proc = spawn(
    exePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      `--window-size=${VIEW_WIDTH},${VIEW_HEIGHT}`,
      '--force-device-scale-factor=1',
      '--hide-scrollbars',
      'about:blank'
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for Chrome DevTools port.')), 15000);
    let stderrBuf = '';
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString('utf8');
      const m = stderrBuf.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);
      if (m) {
        clearTimeout(timer);
        resolve(Number(m[1]));
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Chrome exited prematurely with code ${code}: ${stderrBuf}`));
    });
  });

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  if (!pageTarget?.webSocketDebuggerUrl) {
    throw new Error('No page WebSocket debugger URL found.');
  }

  return { proc, wsUrl: pageTarget.webSocketDebuggerUrl };
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true });
      this.ws.addEventListener('error', reject, { once: true });
    });
    this.ws.addEventListener('message', (event) => {
      const payload = JSON.parse(String(event.data));
      if (payload.id && this.pending.has(payload.id)) {
        const { resolve, reject } = this.pending.get(payload.id);
        this.pending.delete(payload.id);
        if (payload.error) reject(new Error(payload.error.message || JSON.stringify(payload.error)));
        else resolve(payload.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evalJs(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Runtime.evaluate exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function run() {
  const dashHtmlPath = path.join(BUNDLE_BIN_DIR, 'dashboard.html');
  const sideHtmlPath = path.join(BUNDLE_BIN_DIR, 'sidebar.html');
  if (!fs.existsSync(dashHtmlPath) || !fs.existsSync(sideHtmlPath)) {
    throw new Error('Missing built plugin HTML files. Run `npm run build:plugin` first.');
  }

  const [dashHtml, sideHtml] = await Promise.all([
    fsp.readFile(dashHtmlPath, 'utf8'),
    fsp.readFile(sideHtmlPath, 'utf8')
  ]);
  const stageHtml = buildStageHtml();

  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'tokenscope-demo-'));
  const framesDir = path.join(tempRoot, 'frames');
  const profileDir = path.join(tempRoot, 'chrome-profile');
  await fsp.mkdir(framesDir, { recursive: true });
  await fsp.mkdir(profileDir, { recursive: true });
  await fsp.mkdir(DOCS_DIR, { recursive: true });

  const { server, url } = await startLocalServer(dashHtml, sideHtml, stageHtml);
  let browserProc = null;
  let cdp = null;

  try {
    const browserExe = findBrowserExecutable();
    console.log('[render-demo-gif] Launching browser:', browserExe);
    const launched = await launchHeadlessChrome(browserExe, profileDir);
    browserProc = launched.proc;
    cdp = new CdpClient(launched.wsUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.send('Page.navigate', { url });

    // Wait for both iframes to complete MCP App handshake & render telemetry
    let ready = false;
    for (let i = 0; i < 60; i++) {
      ready = Boolean(await cdp.evalJs('window.__demoApi && window.__demoApi.isReady()'));
      if (ready) break;
      await sleep(150);
    }
    if (!ready) {
      throw new Error('Timed out waiting for dashboard & sidebar iframes to hydrate.');
    }
    await sleep(300);

    let frameIndex = 0;
    const screenshotPaths = [];
    const captureFrame = async (saveAsKeyFrame = false) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(data, 'base64');
      const filePath = path.join(framesDir, `frame_${String(frameIndex).padStart(4, '0')}.png`);
      await fsp.writeFile(filePath, buf);
      screenshotPaths.push(filePath);
      if (saveAsKeyFrame) {
        await fsp.writeFile(path.join(DOCS_DIR, 'screenshot.png'), buf);
      }
      frameIndex += 1;
    };

    // Scene 1 (0 - 22): Optical Telemetry Intro with laser scan sweep
    await cdp.evalJs(`window.__demoApi.setScene('01 // OPTICAL TELEMETRY', false)`);
    for (let f = 0; f < 22; f++) {
      const y = -8 + (f / 18) * (VIEW_HEIGHT + 24);
      const opacity = f < 18 ? 0.9 : 0;
      await cdp.evalJs(`window.__demoApi.setScanY(${y.toFixed(1)}, ${opacity})`);
      await captureFrame(f === 19);
      await sleep(30);
    }

    // Scene 2 (22 - 50): 10-Step Progressive Heatmap Popover Inspection
    await cdp.evalJs(`window.__demoApi.setScene('02 // 10-STEP HEATMAP', false)`);
    const cell1 = await cdp.evalJs(`window.__demoApi.getDashTargetPos('.heatmap-cell', 145)`);
    const cell2 = await cdp.evalJs(`window.__demoApi.getDashTargetPos('.heatmap-cell', 178)`);
    for (let f = 0; f < 28; f++) {
      if (f < 8 && cell1) {
        const t = (f + 1) / 8;
        const cx = 320 + (cell1.x - 320) * t;
        const cy = 220 + (cell1.y - 220) * t;
        await cdp.evalJs(`window.__demoApi.setCursor(${cx.toFixed(1)}, ${cy.toFixed(1)}, true, false)`);
        if (f === 7) await cdp.evalJs(`window.__demoApi.triggerDashHover('.heatmap-cell', 145)`);
      } else if (f >= 8 && f < 16) {
        await captureFrame();
        await sleep(30);
        continue;
      } else if (f === 16 && cell2) {
        await cdp.evalJs(`window.__demoApi.triggerDashLeave('.heatmap-cell', 145)`);
        await cdp.evalJs(`window.__demoApi.setCursor(${cell2.x.toFixed(1)}, ${cell2.y.toFixed(1)}, true, false)`);
        await cdp.evalJs(`window.__demoApi.triggerDashHover('.heatmap-cell', 178)`);
      } else if (f === 27) {
        await cdp.evalJs(`window.__demoApi.triggerDashLeave('.heatmap-cell', 178)`);
      }
      await captureFrame();
      await sleep(35);
    }

    // Scene 3 (50 - 74): Instant Bilingual Switch (ZH -> EN -> ZH)
    await cdp.evalJs(`window.__demoApi.setScene('03 // BILINGUAL ZH / EN', false)`);
    const langPos = await cdp.evalJs(`window.__demoApi.getDashTargetPos('.lang-btn', 0)`);
    for (let f = 0; f < 24; f++) {
      if (f === 4 && langPos) {
        await cdp.evalJs(`window.__demoApi.setCursor(${langPos.x.toFixed(1)}, ${langPos.y.toFixed(1)}, true, true)`);
      } else if (f === 6 && langPos) {
        await cdp.evalJs(`window.__demoApi.clickDash('.lang-btn')`);
        await cdp.evalJs(`window.__demoApi.setCursor(${langPos.x.toFixed(1)}, ${langPos.y.toFixed(1)}, true, false)`);
      } else if (f === 19) {
        await cdp.evalJs(`window.__demoApi.setCursor(${langPos.x.toFixed(1)}, ${langPos.y.toFixed(1)}, true, true)`);
      } else if (f === 21) {
        await cdp.evalJs(`window.__demoApi.clickDash('.lang-btn')`);
        await cdp.evalJs(`window.__demoApi.setCursor(${langPos.x.toFixed(1)}, ${langPos.y.toFixed(1)}, true, false)`);
      }
      await captureFrame();
      await sleep(35);
    }

    // Scene 4 (74 - 92): Manual Incremental Refresh & Live Delta Update
    await cdp.evalJs(`window.__demoApi.setScene('04 // INCREMENTAL SYNC', false)`);
    const refreshPos = await cdp.evalJs(`window.__demoApi.getDashTargetPos('.button', 0)`);
    for (let f = 0; f < 18; f++) {
      if (f === 3 && refreshPos) {
        await cdp.evalJs(`window.__demoApi.setCursor(${refreshPos.x.toFixed(1)}, ${refreshPos.y.toFixed(1)}, true, true)`);
      } else if (f === 5 && refreshPos) {
        await cdp.evalJs(`window.__demoApi.clickDash('.button')`);
        await cdp.evalJs(`window.__demoApi.setCursor(${refreshPos.x.toFixed(1)}, ${refreshPos.y.toFixed(1)}, true, false)`);
      } else if (f === 14) {
        await cdp.evalJs(`window.__demoApi.setCursor(0, 0, false, false)`);
      }
      await captureFrame();
      await sleep(75);
    }

    // Scene 5 (92 - 114): Dual-Pane Official Native Plugin Showcase
    await cdp.evalJs(`window.__demoApi.setScene('05 // DUAL-PANE NATIVE PLUGIN', true)`);
    for (let f = 0; f < 22; f++) {
      await captureFrame(f === 16);
      await sleep(40);
    }

    console.log(`[render-demo-gif] Captured ${frameIndex} frames. Encoding GIF via ffmpeg...`);

    const inputPattern = path.join(framesDir, 'frame_%04d.png');
    const palettePath = path.join(tempRoot, 'palette.png');
    const outGifPath = path.join(DOCS_DIR, 'demo.gif');

    const runFfmpeg = (args) => {
      const res = spawnSync('ffmpeg', args, { encoding: 'utf8' });
      if (res.status !== 0) {
        throw new Error(`ffmpeg failed: ${res.stderr}`);
      }
    };

    runFfmpeg([
      '-y', '-framerate', String(FPS), '-i', inputPattern,
      '-vf', 'palettegen=max_colors=256:stats_mode=diff',
      palettePath
    ]);
    runFfmpeg([
      '-y', '-framerate', String(FPS), '-i', inputPattern, '-i', palettePath,
      '-lavfi', 'paletteuse=dither=sierra2_4a:diff_mode=rectangle',
      outGifPath
    ]);

    let gifStat = await fsp.stat(outGifPath);
    if (gifStat.size > 4.2 * 1024 * 1024) {
      console.log(`[render-demo-gif] GIF size ${(gifStat.size / 1024 / 1024).toFixed(2)} MiB > 4.2 MiB, optimizing scale to 1080px...`);
      runFfmpeg([
        '-y', '-framerate', String(FPS), '-i', inputPattern,
        '-vf', 'scale=1080:-1:flags=lanczos,palettegen=max_colors=192:stats_mode=diff',
        palettePath
      ]);
      runFfmpeg([
        '-y', '-framerate', String(FPS), '-i', inputPattern, '-i', palettePath,
        '-lavfi', 'scale=1080:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
        outGifPath
      ]);
      gifStat = await fsp.stat(outGifPath);
    }

    const pngStat = await fsp.stat(path.join(DOCS_DIR, 'screenshot.png'));
    console.log(`[render-demo-gif] Done! demo.gif: ${(gifStat.size / 1024).toFixed(1)} KiB, screenshot.png: ${(pngStat.size / 1024).toFixed(1)} KiB`);
  } finally {
    if (cdp) cdp.close();
    if (browserProc) {
      try {
        browserProc.kill();
      } catch {}
    }
    server.close();
    await fsp.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

run().catch((err) => {
  console.error('[render-demo-gif] Failed:', err);
  process.exit(1);
});

