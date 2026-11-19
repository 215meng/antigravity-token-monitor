import { describe, expect, it } from 'vitest';
import { canonicalizeModelId, formatModelDisplayName, resolveModelPlaceholder } from './modelAliases';

describe('modelAliases', () => {
  it('resolves legacy and existing model placeholders', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M37')).toBe('gemini-3.1-pro-high');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M36')).toBe('gemini-3.1-pro-low');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M18')).toBe('gemini-3-flash');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M8')).toBe('gemini-3-pro-high');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M26')).toBe('claude-opus-4-6-thinking');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M35')).toBe('claude-sonnet-4-6-thinking');
    expect(resolveModelPlaceholder('MODEL_OPENAI_GPT_OSS_120B_MEDIUM')).toBe('gpt-oss-120b-medium');
  });

  it('resolves Gemini 3.8 and Gemini 2.5 identifiers', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M38')).toBe('gemini-3.8-flash');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M39')).toBe('gemini-3.8-pro');
    expect(resolveModelPlaceholder('MODEL_GEMINI_3_8_FLASH')).toBe('gemini-3.8-flash');
    expect(resolveModelPlaceholder('MODEL_GEMINI_3_8_PRO')).toBe('gemini-3.8-pro');

    expect(resolveModelPlaceholder('MODEL_GEMINI_3_FLASH')).toBe('gemini-3-flash');
    expect(resolveModelPlaceholder('MODEL_GEMINI_3_PRO')).toBe('gemini-3-pro');

    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M24')).toBe('gemini-2.5-flash');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M25')).toBe('gemini-2.5-pro');
    expect(resolveModelPlaceholder('MODEL_GEMINI_2_5_FLASH')).toBe('gemini-2.5-flash');
    expect(resolveModelPlaceholder('MODEL_GEMINI_2_5_PRO')).toBe('gemini-2.5-pro');
  });

  it('resolves Claude 3.7 and Claude 3.5 identifiers', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M33')).toBe('claude-3-7-sonnet');
    expect(resolveModelPlaceholder('MODEL_CLAUDE_3_7_SONNET')).toBe('claude-3-7-sonnet');
    expect(resolveModelPlaceholder('MODEL_CLAUDE_3_7_SONNET_THINKING')).toBe('claude-3-7-sonnet-thinking');

    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M34')).toBe('claude-3-5-sonnet-20241022');
    expect(resolveModelPlaceholder('MODEL_CLAUDE_3_5_SONNET')).toBe('claude-3-5-sonnet');
    expect(resolveModelPlaceholder('MODEL_CLAUDE_3_5_SONNET_20241022')).toBe('claude-3-5-sonnet-20241022');
    expect(resolveModelPlaceholder('MODEL_CLAUDE_3_5_HAIKU')).toBe('claude-3-5-haiku');
  });

  it('resolves OpenAI GPT-4o, o3-mini and o-series identifiers', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M40')).toBe('gpt-4o');
    expect(resolveModelPlaceholder('MODEL_OPENAI_GPT_4O')).toBe('gpt-4o');
    expect(resolveModelPlaceholder('MODEL_OPENAI_GPT_4O_MINI')).toBe('gpt-4o-mini');

    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M41')).toBe('o3-mini');
    expect(resolveModelPlaceholder('MODEL_OPENAI_O3_MINI')).toBe('o3-mini');
    expect(resolveModelPlaceholder('MODEL_OPENAI_O3_MINI_HIGH')).toBe('o3-mini-high');
    expect(resolveModelPlaceholder('MODEL_OPENAI_O1')).toBe('o1');
  });

  it('resolves DeepSeek chat and reasoner identifiers', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M50')).toBe('deepseek-chat');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M51')).toBe('deepseek-reasoner');
    expect(resolveModelPlaceholder('MODEL_DEEPSEEK_CHAT')).toBe('deepseek-chat');
    expect(resolveModelPlaceholder('MODEL_DEEPSEEK_V3')).toBe('deepseek-chat');
    expect(resolveModelPlaceholder('MODEL_DEEPSEEK_REASONER')).toBe('deepseek-reasoner');
    expect(resolveModelPlaceholder('MODEL_DEEPSEEK_R1')).toBe('deepseek-reasoner');
  });

  it('returns undefined for unknown placeholders', () => {
    expect(resolveModelPlaceholder('UNKNOWN_MODEL_123')).toBeUndefined();
    expect(resolveModelPlaceholder('')).toBeUndefined();
  });

  it('resolves newly introduced Antigravity placeholders including M318', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M318')).toBe('gemini-3.8-flash');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M16')).toBe('gemini-3-flash');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M299')).toBe('gemini-3.8-pro');
  });

  it('canonicalizes model variations into clean model families', () => {
    expect(canonicalizeModelId('MODEL_PLACEHOLDER_M318')).toBe('gemini-3.8-flash');
    expect(canonicalizeModelId('gemini-3.8-flash-n')).toBe('gemini-3.8-flash');
    expect(canonicalizeModelId('gemini-3.8-flash-tiered')).toBe('gemini-3.8-flash');
    expect(canonicalizeModelId('gemini-3p7-flash-exp-c')).toBe('gemini-3.8-flash');
    expect(canonicalizeModelId('gemini-pro-default')).toBe('gemini-3.1-pro');
    expect(canonicalizeModelId('claude-opus-4-6-thinking')).toBe('claude-opus-4-6-thinking');
    expect(canonicalizeModelId('unknown')).toBe('gemini-3.8-flash');
  });

  it('formats user-friendly model display names', () => {
    expect(formatModelDisplayName('gemini-3.8-flash-n')).toBe('Gemini 3.8 Flash');
    expect(formatModelDisplayName('MODEL_PLACEHOLDER_M318')).toBe('Gemini 3.8 Flash');
    expect(formatModelDisplayName('gemini-3.1-pro-high')).toBe('Gemini 3.1 Pro');
    expect(formatModelDisplayName('claude-opus-4-6-thinking')).toBe('Claude Opus 4.6 (Thinking)');
  });

  it('resolves and canonicalizes Gemini 4, Orchestrator, Claude 5.5 and GPT-OSS 120B models', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M417')).toBe('gemini-4-argon');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M418')).toBe('gemini-4-argon');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M419')).toBe('gemini-4-argon');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M528')).toBe('gemini-4-hydrogen');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M670')).toBe('gemini-4-carbon');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M668')).toBe('orchestrator-argon');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M400')).toBe('claude-opus-5-5');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M404')).toBe('claude-sonnet-5-5');
    expect(resolveModelPlaceholder('1417')).toBe('gemini-4-argon');
    expect(resolveModelPlaceholder('1668')).toBe('orchestrator-argon');

    expect(canonicalizeModelId('gemini-4-argon-trial')).toBe('gemini-4-argon');
    expect(canonicalizeModelId('Gemini 4 Argon (High)')).toBe('gemini-4-argon');
    expect(canonicalizeModelId('gemini-4-hydrogen-tiered-high')).toBe('gemini-4-hydrogen');
    expect(canonicalizeModelId('gemini-4-carbon-disabled')).toBe('gemini-4-carbon');
    expect(canonicalizeModelId('gemini-pro-orchestrator-g1-pro')).toBe('orchestrator-argon');
    expect(canonicalizeModelId('Orchestrator (Argon)')).toBe('orchestrator-argon');
    expect(canonicalizeModelId('claude-opus-5-5-max')).toBe('claude-opus-5-5');
    expect(canonicalizeModelId('claude-sonnet-5-5-high')).toBe('claude-sonnet-5-5');
    expect(canonicalizeModelId('MODEL_OPENAI_GPT_OSS_120B_MEDIUM')).toBe('gpt-oss-120b-medium');
    expect(canonicalizeModelId('gemini-3.6-flash')).toBe('gemini-3.8-flash');

    expect(formatModelDisplayName('gemini-4-argon-trial')).toBe('Gemini 4 Argon');
    expect(formatModelDisplayName('gemini-4-hydrogen-tiered-high')).toBe('Gemini 4 Hydrogen');
    expect(formatModelDisplayName('gemini-4-carbon-disabled')).toBe('Gemini 4 Carbon');
    expect(formatModelDisplayName('gemini-pro-orchestrator-g1-pro')).toBe('Orchestrator (Argon)');
    expect(formatModelDisplayName('claude-opus-5-5-high')).toBe('Claude Opus 5.5');
    expect(formatModelDisplayName('claude-sonnet-5-5-medium')).toBe('Claude Sonnet 5.5');
    expect(formatModelDisplayName('MODEL_OPENAI_GPT_OSS_120B_MEDIUM')).toBe('GPT-OSS 120B (Medium)');
  });

  it('resolves and canonicalizes Gemini 4 Neon, Orchestrator (Neon), Orchestrator Worker, and dynamic Gemini 4 models', () => {
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M537')).toBe('orchestrator-neon');
    expect(resolveModelPlaceholder('1537')).toBe('orchestrator-neon');
    expect(resolveModelPlaceholder('MODEL_PLACEHOLDER_M669')).toBe('gemini-4-hydrogen-orchestrator');
    expect(resolveModelPlaceholder('1669')).toBe('gemini-4-hydrogen-orchestrator');

    expect(canonicalizeModelId('gemini-4-neon')).toBe('gemini-4-neon');
    expect(canonicalizeModelId('gemini-4-neon-medium')).toBe('gemini-4-neon');
    expect(canonicalizeModelId('Gemini 4 Neon (Medium)')).toBe('gemini-4-neon');
    expect(canonicalizeModelId('gemini-pro-orchestrator-neon')).toBe('orchestrator-neon');
    expect(canonicalizeModelId('Orchestrator (Neon)')).toBe('orchestrator-neon');
    expect(canonicalizeModelId('MODEL_PLACEHOLDER_M537')).toBe('orchestrator-neon');
    expect(canonicalizeModelId('gemini-flash-worker-agy')).toBe('gemini-4-hydrogen-orchestrator');
    expect(canonicalizeModelId('Gemini 4 Hydrogen (Orchestrator)')).toBe('gemini-4-hydrogen-orchestrator');
    expect(canonicalizeModelId('MODEL_PLACEHOLDER_M669')).toBe('gemini-4-hydrogen-orchestrator');

    // 确保 Argon 不会被 Neon 覆盖或串类
    expect(canonicalizeModelId('gemini-pro-orchestrator-g1-pro')).toBe('orchestrator-argon');
    expect(canonicalizeModelId('Orchestrator (Argon)')).toBe('orchestrator-argon');

    // 动态兼容未来 Gemini 4 / Orchestrator 新元素模型
    expect(canonicalizeModelId('Gemini 4 Helium (High)')).toBe('gemini-4-helium');
    expect(canonicalizeModelId('Orchestrator (Carbon)')).toBe('orchestrator-carbon');

    expect(formatModelDisplayName('gemini-4-neon-medium')).toBe('Gemini 4 Neon');
    expect(formatModelDisplayName('gemini-pro-orchestrator-neon')).toBe('Orchestrator (Neon)');
    expect(formatModelDisplayName('gemini-flash-worker-agy')).toBe('Gemini 4 Hydrogen (Orchestrator)');
    expect(formatModelDisplayName('Gemini 4 Helium (High)')).toBe('Gemini 4 Helium');
    expect(formatModelDisplayName('Orchestrator (Carbon)')).toBe('Orchestrator (Carbon)');
  });
});
