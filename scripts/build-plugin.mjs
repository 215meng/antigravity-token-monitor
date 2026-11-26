import esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templateDir = path.join(rootDir, 'plugin-template');
const outDir = path.join(rootDir, 'dist', 'antigravity-plugin');
const binDir = path.join(outDir, 'bin');

const MAX_HTML_BYTES = 10 * 1024 * 1024;

function escapeInlineScript(code) {
  return code.replace(/<\/script>/gi, '<\\/script>');
}

function wrapDashboardHtml(bundleJs) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Antigravity Token Monitor</title>
    <style>
      :root {
        color-scheme: dark light;
        --bg: var(--color-background-primary, #0b1012);
        --bg-elevated: var(--color-background-secondary, rgba(20, 29, 33, 0.88));
        --panel: var(--color-background-tertiary, rgba(15, 22, 25, 0.82));
        --surface-base: var(--bg);
        --surface-glass: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
        --surface-elevated: color-mix(in srgb, var(--bg-elevated) 92%, #ffffff 4%);
        --popover-bg: var(--color-background-primary, #121a1d);
        --panel-deep: color-mix(in srgb, var(--bg-elevated) 84%, #000 16%);
        --line: var(--color-border-primary, rgba(148, 194, 179, 0.14));
        --line-hover: var(--color-border-secondary, rgba(148, 214, 192, 0.3));
        --line-strong: var(--color-ring-primary, rgba(171, 220, 204, 0.28));
        --edge-highlight: linear-gradient(90deg, transparent, rgba(136, 216, 176, 0.55), transparent);
        --text: var(--color-text-primary, #e8f1ed);
        --muted: var(--color-text-secondary, #93a79f);
        --accent: var(--color-text-info, #5eead4);
        --accent-strong: var(--color-text-success, #a7f3d0);
        --accent-emerald: #b9f48c;
        --accent-cache: #60a5fa;
        --warm: var(--color-text-warning, #fbbf24);
        --danger: var(--color-text-danger, #f87171);
        --focus: var(--color-ring-primary, #38bdf8);
        --surface-line: var(--color-border-secondary, rgba(255, 255, 255, 0.06));
        --surface-subtle: rgba(255, 255, 255, 0.028);
        --track-bg: rgba(255, 255, 255, 0.06);
        --bar-neutral: rgba(255, 255, 255, 0.35);
        --shadow: 0 20px 50px rgba(0, 0, 0, 0.32);
        --shadow-elevated: 0 10px 28px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        --ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
        --hm-0: rgba(255, 255, 255, 0.035);
        --hm-border-0: rgba(255, 255, 255, 0.06);
        --hm-1: #163242;
        --hm-2: #17445a;
        --hm-3: #185773;
        --hm-4: #186a8c;
        --hm-5: #177ea6;
        --hm-6: #1a92bf;
        --hm-7: #25a6d6;
        --hm-8: #3cb9e8;
        --hm-9: #5ecdf5;
        --hm-10: #8ae0fc;
        --code-font: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --font-display: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --font-body: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --radius: 16px;
        --spacing-xs: 4px;
        --spacing-sm: 8px;
        --spacing-md: 16px;
        --spacing-lg: 24px;
        --spacing-xl: 32px;
        --spacing-2xl: 48px;
        --hero-bg: linear-gradient(165deg, color-mix(in srgb, var(--bg-elevated) 92%, #5eead4 4%) 0%, var(--panel) 100%);
        --canvas-bg: transparent;
        --rail-bg: var(--panel);
        --deck-bg: var(--panel);
      }

      :root[data-theme="light"] {
        --bg: var(--color-background-primary, #f8fafc);
        --bg-elevated: var(--color-background-secondary, #ffffff);
        --panel: var(--color-background-tertiary, #f1f5f9);
        --surface-base: var(--bg);
        --surface-glass: rgba(255, 255, 255, 0.86);
        --surface-elevated: #ffffff;
        --popover-bg: var(--color-background-primary, #ffffff);
        --panel-deep: color-mix(in srgb, var(--bg) 94%, #000 6%);
        --line: var(--color-border-primary, rgba(15, 23, 42, 0.1));
        --line-hover: rgba(13, 148, 136, 0.34);
        --line-strong: var(--color-ring-primary, rgba(15, 23, 42, 0.22));
        --edge-highlight: linear-gradient(90deg, transparent, rgba(13, 148, 136, 0.38), transparent);
        --text: var(--color-text-primary, #0f172a);
        --muted: var(--color-text-secondary, #475569);
        --surface-line: rgba(15, 23, 42, 0.07);
        --surface-subtle: rgba(15, 23, 42, 0.025);
        --track-bg: rgba(15, 23, 42, 0.07);
        --bar-neutral: rgba(15, 23, 42, 0.28);
        --accent: var(--color-text-info, #0f766e);
        --accent-strong: var(--color-text-success, #0d9488);
        --accent-emerald: #15803d;
        --accent-cache: #2563eb;
        --warm: var(--color-text-warning, #b45309);
        --danger: var(--color-text-danger, #dc2626);
        --shadow: 0 10px 28px rgba(15, 23, 42, 0.07);
        --shadow-elevated: 0 6px 20px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        --hero-bg: linear-gradient(165deg, #ffffff 0%, #f1f5f9 100%);
        --hm-0: #eef2f6;
        --hm-border-0: rgba(15, 23, 42, 0.08);
        --hm-1: #e0f2fe;
        --hm-2: #bae6fd;
        --hm-3: #8dd6fb;
        --hm-4: #60c4f8;
        --hm-5: #38b2f2;
        --hm-6: #1c9be3;
        --hm-7: #0c84cd;
        --hm-8: #096fb4;
        --hm-9: #105c9e;
        --hm-10: #1d4ed8;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body {
        font: 13px/1.45 var(--font-body);
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
      }
      button, input { font: inherit; }
      code, pre, .mono { font-family: var(--code-font); }
      *:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    </style>
  </head>
  <body>
    <div id="app" class="dashboard-app-shell"></div>
    <script>${escapeInlineScript(bundleJs)}</script>
  </body>
</html>`;
}

function wrapSidebarHtml(bundleJs) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Token 用量</title>
    <style>
      :root {
        color-scheme: dark light;
        --bg: var(--color-background-primary, #0b1012);
        --bg-elevated: var(--color-background-secondary, rgba(20, 29, 33, 0.88));
        --panel: var(--color-background-tertiary, rgba(15, 22, 25, 0.82));
        --surface-base: var(--bg);
        --surface-glass: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
        --surface-elevated: color-mix(in srgb, var(--bg-elevated) 92%, #ffffff 4%);
        --popover-bg: var(--color-background-primary, #121a1d);
        --panel-deep: color-mix(in srgb, var(--bg-elevated) 84%, #000 16%);
        --line: var(--color-border-primary, rgba(148, 194, 179, 0.14));
        --line-hover: var(--color-border-secondary, rgba(148, 214, 192, 0.3));
        --line-strong: var(--color-ring-primary, rgba(171, 220, 204, 0.28));
        --edge-highlight: linear-gradient(90deg, transparent, rgba(136, 216, 176, 0.55), transparent);
        --text: var(--color-text-primary, #e8f1ed);
        --muted: var(--color-text-secondary, #93a79f);
        --accent: var(--color-text-info, #5eead4);
        --accent-strong: var(--color-text-success, #a7f3d0);
        --accent-emerald: #b9f48c;
        --accent-cache: #60a5fa;
        --warm: var(--color-text-warning, #fbbf24);
        --danger: var(--color-text-danger, #f87171);
        --focus: var(--color-ring-primary, #38bdf8);
        --surface-line: var(--color-border-secondary, rgba(255, 255, 255, 0.06));
        --surface-subtle: rgba(255, 255, 255, 0.028);
        --track-bg: rgba(255, 255, 255, 0.06);
        --bar-neutral: rgba(255, 255, 255, 0.35);
        --shadow-elevated: 0 6px 20px rgba(0, 0, 0, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.04);
        --ease-spring: cubic-bezier(0.22, 1, 0.36, 1);
        --hm-0: rgba(255, 255, 255, 0.035);
        --hm-border-0: rgba(255, 255, 255, 0.06);
        --hm-1: #163242;
        --hm-2: #17445a;
        --hm-3: #185773;
        --hm-4: #186a8c;
        --hm-5: #177ea6;
        --hm-6: #1a92bf;
        --hm-7: #25a6d6;
        --hm-8: #3cb9e8;
        --hm-9: #5ecdf5;
        --hm-10: #8ae0fc;
        --code-font: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --font-display: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --font-body: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --radius: 12px;
        --radius-sm: 7px;
        --spacing-xs: 4px;
        --spacing-sm: 6px;
        --spacing-md: 12px;
        --spacing-lg: 16px;
        --spacing-xl: 20px;
      }

      :root[data-theme="light"] {
        --bg: var(--color-background-primary, #f8fafc);
        --bg-elevated: var(--color-background-secondary, #ffffff);
        --panel: var(--color-background-tertiary, #f1f5f9);
        --surface-base: var(--bg);
        --surface-glass: rgba(255, 255, 255, 0.86);
        --surface-elevated: #ffffff;
        --popover-bg: var(--color-background-primary, #ffffff);
        --panel-deep: color-mix(in srgb, var(--bg) 94%, #000 6%);
        --line: var(--color-border-primary, rgba(15, 23, 42, 0.1));
        --line-hover: rgba(13, 148, 136, 0.34);
        --line-strong: var(--color-ring-primary, rgba(15, 23, 42, 0.22));
        --edge-highlight: linear-gradient(90deg, transparent, rgba(13, 148, 136, 0.38), transparent);
        --text: var(--color-text-primary, #0f172a);
        --muted: var(--color-text-secondary, #475569);
        --surface-line: rgba(15, 23, 42, 0.07);
        --surface-subtle: rgba(15, 23, 42, 0.025);
        --track-bg: rgba(15, 23, 42, 0.07);
        --bar-neutral: rgba(15, 23, 42, 0.28);
        --accent: var(--color-text-info, #0f766e);
        --accent-strong: var(--color-text-success, #0d9488);
        --accent-emerald: #15803d;
        --accent-cache: #2563eb;
        --warm: var(--color-text-warning, #b45309);
        --danger: var(--color-text-danger, #dc2626);
        --shadow-elevated: 0 4px 14px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.8);
        --hm-0: #eef2f6;
        --hm-border-0: rgba(15, 23, 42, 0.08);
        --hm-1: #e0f2fe;
        --hm-2: #bae6fd;
        --hm-3: #8dd6fb;
        --hm-4: #60c4f8;
        --hm-5: #38b2f2;
        --hm-6: #1c9be3;
        --hm-7: #0c84cd;
        --hm-8: #096fb4;
        --hm-9: #105c9e;
        --hm-10: #1d4ed8;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body {
        font: 12px/1.45 var(--font-body);
        min-height: 100vh;
        -webkit-font-smoothing: antialiased;
      }
      button, input { font: inherit; }
      code, pre, .mono { font-family: var(--code-font); }
      *:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      }
    </style>
  </head>
  <body>
    <div id="sidebar-app"></div>
    <script>${escapeInlineScript(bundleJs)}</script>
  </body>
</html>`;
}

async function bundleBrowserEntry(entryRelativePath) {
  const result = await esbuild.build({
    entryPoints: [path.join(rootDir, entryRelativePath)],
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    plugins: [
      esbuildSvelte({
        compilerOptions: { css: 'injected' }
      })
    ]
  });

  const output = result.outputFiles?.[0]?.text;
  if (!output) {
    throw new Error(`No output produced for ${entryRelativePath}`);
  }
  return output;
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
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function run() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(binDir, { recursive: true });

  const isDev = process.argv.includes('--dev');
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'mcp', 'server.ts')],
    outfile: path.join(binDir, 'mcp-server.cjs'),
    bundle: true,
    platform: 'node',
    target: ['node20'],
    format: 'cjs',
    sourcemap: isDev,
    external: ['node:sqlite']
  });

  const [dashboardJs, sidebarJs] = await Promise.all([
    bundleBrowserEntry('src/webview/mcp/dashboardMain.ts'),
    bundleBrowserEntry('src/webview/mcp/sidebarMain.ts')
  ]);

  const dashboardHtml = wrapDashboardHtml(dashboardJs);
  const sidebarHtml = wrapSidebarHtml(sidebarJs);

  const dashboardPath = path.join(binDir, 'dashboard.html');
  const sidebarPath = path.join(binDir, 'sidebar.html');

  await Promise.all([
    fs.writeFile(dashboardPath, dashboardHtml, 'utf8'),
    fs.writeFile(sidebarPath, sidebarHtml, 'utf8')
  ]);

  await copyDirRecursive(templateDir, outDir);

  for (const [label, filePath] of [
    ['mcp-server.cjs', path.join(binDir, 'mcp-server.cjs')],
    ['dashboard.html', dashboardPath],
    ['sidebar.html', sidebarPath]
  ]) {
    const stat = await fs.stat(filePath);
    if (label.endsWith('.html') && stat.size >= MAX_HTML_BYTES) {
      throw new Error(`${label} exceeds 10 MiB limit (${stat.size} bytes)`);
    }
    console.log(`[build-plugin] ${label}: ${(stat.size / 1024).toFixed(1)} KiB`);
  }

  console.log(`[build-plugin] Plugin bundle ready at: ${outDir}`);
}

run().catch((error) => {
  console.error('[build-plugin] Failed:', error);
  process.exit(1);
});
