import {
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext
} from '@modelcontextprotocol/ext-apps';

export function applyMcpHostContext(ctx?: Partial<McpUiHostContext> | null): void {
  if (!ctx) {
    return;
  }

  if (ctx.theme) {
    applyDocumentTheme(ctx.theme);
  }

  if (ctx.styles?.variables) {
    applyHostStyleVariables(ctx.styles.variables);
  }

  if (ctx.styles?.css?.fonts) {
    applyHostFonts(ctx.styles.css.fonts);
  }
}
