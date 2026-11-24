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
        --bg: var(--color-background-primary, #0f1416);
        --bg-elevated: var(--color-background-secondary, rgba(27, 36, 39, 0.86));
        --panel: var(--color-background-tertiary, rgba(17, 23, 26, 0.84));
        --popover-bg: var(--color-background-primary, #151d20);
        --panel-deep: color-mix(in srgb, var(--bg-elevated) 84%, #000 16%);
        --line: var(--color-border-primary, rgba(151, 190, 177, 0.16));
        --line-strong: var(--color-ring-primary, rgba(171, 220, 204, 0.24));
        --text: var(--color-text-primary, #e7efe7);
        --muted: var(--color-text-secondary, #9aaca4);
        --accent: var(--color-text-info, #88d8b0);
        --accent-strong: var(--color-text-success, #c7f296);
        --warm: var(--color-text-warning, #f7c873);
        --danger: var(--color-text-danger, #ef7d78);
        --focus: var(--color-ring-primary, #2a9df4);
        --surface-line: var(--color-border-secondary, rgba(255, 255, 255, 0.055));
        --surface-subtle: rgba(255, 255, 255, 0.03);
        --track-bg: rgba(255, 255, 255, 0.06);
        --bar-neutral: rgba(255, 255, 255, 0.35);
        --shadow: 0 18px 48px rgba(0, 0, 0, 0.28);
        --shadow-elevated: 0 12px 30px rgba(0, 0, 0, 0.35);
        --code-font: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --font-display: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --font-body: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --radius: 18px;
        --spacing-xs: 4px;
        --spacing-sm: 8px;
        --spacing-md: 16px;
        --spacing-lg: 24px;
        --spacing-xl: 32px;
        --spacing-2xl: 48px;
        --hero-bg: linear-gradient(180deg, var(--bg-elevated) 0%, var(--panel) 100%);
        --canvas-bg: transparent;
        --rail-bg: var(--panel);
        --deck-bg: var(--panel);
      }

      :root[data-theme="light"] {
        --bg: var(--color-background-primary, #ffffff);
        --bg-elevated: var(--color-background-secondary, #f4f6f8);
        --panel: var(--color-background-tertiary, #f8fafc);
        --popover-bg: var(--color-background-primary, #ffffff);
        --panel-deep: color-mix(in srgb, var(--bg) 94%, #000 6%);
        --line: var(--color-border-primary, rgba(15, 23, 42, 0.12));
        --line-strong: var(--color-ring-primary, rgba(15, 23, 42, 0.24));
        --text: var(--color-text-primary, #111827);
        --muted: var(--color-text-secondary, #4b5563);
        --surface-line: rgba(15, 23, 42, 0.08);
        --surface-subtle: rgba(15, 23, 42, 0.03);
        --track-bg: rgba(15, 23, 42, 0.08);
        --bar-neutral: rgba(15, 23, 42, 0.28);
        --accent: var(--color-text-info, #0f766e);
        --accent-strong: var(--color-text-success, #0d9488);
        --warm: var(--color-text-warning, #b45309);
        --danger: var(--color-text-danger, #dc2626);
        --shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
        --shadow-elevated: 0 6px 18px rgba(15, 23, 42, 0.06);
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body {
        font: 13px/1.45 var(--font-body);
        min-height: 100vh;
      }
      button, input { font: inherit; }
      code, pre, .mono { font-family: var(--code-font); }
      *:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
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
        --bg: var(--color-background-primary, #0f1416);
        --bg-elevated: var(--color-background-secondary, rgba(27, 36, 39, 0.86));
        --panel: var(--color-background-tertiary, rgba(17, 23, 26, 0.84));
        --popover-bg: var(--color-background-primary, #151d20);
        --panel-deep: color-mix(in srgb, var(--bg-elevated) 84%, #000 16%);
        --line: var(--color-border-primary, rgba(151, 190, 177, 0.16));
        --line-strong: var(--color-ring-primary, rgba(171, 220, 204, 0.24));
        --text: var(--color-text-primary, #e7efe7);
        --muted: var(--color-text-secondary, #9aaca4);
        --accent: var(--color-text-info, #88d8b0);
        --accent-strong: var(--color-text-success, #c7f296);
        --warm: var(--color-text-warning, #f7c873);
        --danger: var(--color-text-danger, #ef7d78);
        --focus: var(--color-ring-primary, #2a9df4);
        --surface-line: var(--color-border-secondary, rgba(255, 255, 255, 0.055));
        --surface-subtle: rgba(255, 255, 255, 0.03);
        --track-bg: rgba(255, 255, 255, 0.06);
        --bar-neutral: rgba(255, 255, 255, 0.35);
        --code-font: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --font-display: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --font-body: var(--font-sans, "Segoe UI", "Inter", system-ui, sans-serif);
        --radius: 10px;
        --radius-sm: 6px;
        --spacing-xs: 4px;
        --spacing-sm: 6px;
        --spacing-md: 12px;
        --spacing-lg: 16px;
        --spacing-xl: 20px;
      }

      :root[data-theme="light"] {
        --bg: var(--color-background-primary, #ffffff);
        --bg-elevated: var(--color-background-secondary, #f4f6f8);
        --panel: var(--color-background-tertiary, #f8fafc);
        --popover-bg: var(--color-background-primary, #ffffff);
        --panel-deep: color-mix(in srgb, var(--bg) 94%, #000 6%);
        --line: var(--color-border-primary, rgba(15, 23, 42, 0.12));
        --line-strong: var(--color-ring-primary, rgba(15, 23, 42, 0.24));
        --text: var(--color-text-primary, #111827);
        --muted: var(--color-text-secondary, #4b5563);
        --surface-line: rgba(15, 23, 42, 0.08);
        --surface-subtle: rgba(15, 23, 42, 0.03);
        --track-bg: rgba(15, 23, 42, 0.08);
        --bar-neutral: rgba(15, 23, 42, 0.28);
        --accent: var(--color-text-info, #0f766e);
        --accent-strong: var(--color-text-success, #0d9488);
        --warm: var(--color-text-warning, #b45309);
        --danger: var(--color-text-danger, #dc2626);
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body {
        font: 12px/1.45 var(--font-body);
        min-height: 100vh;
      }
      button, input { font: inherit; }
      code, pre, .mono { font-family: var(--code-font); }
      *:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
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
