import * as vscode from 'vscode';

export function getSidebarHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'sidebar', 'main.js'));
  const nonce = createNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}';"
    />
    <title>Token Overview</title>
    <style>
      :root {
        color-scheme: dark light;
        --bg: var(--vscode-sideBar-background, var(--vscode-editor-background, #0b1012));
        --bg-elevated: var(--vscode-editorWidget-background, rgba(20, 29, 33, 0.88));
        --panel: var(--vscode-sideBar-background, var(--vscode-panel-background, rgba(15, 22, 25, 0.82)));
        --surface-base: var(--bg);
        --surface-glass: color-mix(in srgb, var(--bg-elevated) 78%, transparent);
        --surface-elevated: color-mix(in srgb, var(--bg-elevated) 92%, #ffffff 4%);
        --popover-bg: var(--vscode-editorWidget-background, #121a1d);
        --panel-deep: color-mix(in srgb, var(--bg-elevated) 84%, #000 16%);
        --line: var(--vscode-widget-border, rgba(148, 194, 179, 0.14));
        --line-hover: rgba(148, 214, 192, 0.3);
        --line-strong: var(--vscode-focusBorder, rgba(171, 220, 204, 0.28));
        --edge-highlight: linear-gradient(90deg, transparent, rgba(136, 216, 176, 0.55), transparent);
        --text: var(--vscode-editor-foreground, #e8f1ed);
        --muted: var(--color-text-secondary, var(--vscode-descriptionForeground, #93a79f));
        --accent: var(--vscode-textLink-foreground, #5eead4);
        --accent-strong: var(--vscode-textLink-activeForeground, #a7f3d0);
        --accent-emerald: #b9f48c;
        --accent-cache: #60a5fa;
        --warm: var(--vscode-editorWarning-foreground, #fbbf24);
        --danger: var(--vscode-editorError-foreground, #f87171);
        --focus: var(--vscode-focusBorder, #38bdf8);
        --surface-line: rgba(255, 255, 255, 0.06);
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
        --font-display: var(--vscode-font-family, "Segoe UI", "Inter", "SF Pro Text", Arial, sans-serif);
        --font-body: var(--vscode-font-family, "Segoe UI", "Inter", "SF Pro Text", Arial, sans-serif);
        --radius: 10px;
        --radius-sm: 6px;

        --spacing-xs: 4px;
        --spacing-sm: 6px;
        --spacing-md: 12px;
        --spacing-lg: 16px;
        --spacing-xl: 20px;
      }

      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
      body {
        font: 12px/1.45 var(--vscode-font-family, "Segoe UI", "Inter", "SF Pro Text", Arial, sans-serif);
        min-height: 100vh;
      }
      button, input { font: inherit; }
      code, pre, .mono { font-family: var(--code-font); }

      /* Accessibility: Visible focus */
      *:focus-visible {
        outline: 2px solid var(--focus);
        outline-offset: 2px;
      }

      /* High contrast mode support */
      @media (forced-colors: active) {
        :root {
          --line: CanvasText;
          --line-strong: CanvasText;
          --bg-elevated: Canvas;
          --panel: Canvas;
        }
      }
    </style>
  </head>
  <body>
    <div id="sidebar-app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function createNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return value;
}
