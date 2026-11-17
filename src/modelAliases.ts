/**
 * Resolves internal model placeholder IDs to human-readable model names,
 * and canonicalizes experimental model variations into standard model families.
 */

const PLACEHOLDER_MODEL_MAP: Record<string, string> = {
  // Gemini 4 Series & Orchestrator
  'MODEL_PLACEHOLDER_M417': 'gemini-4-argon',
  'MODEL_PLACEHOLDER_M418': 'gemini-4-argon',
  'MODEL_PLACEHOLDER_M419': 'gemini-4-argon',
  'MODEL_PLACEHOLDER_M525': 'gemini-4-hydrogen',
  'MODEL_PLACEHOLDER_M526': 'gemini-4-hydrogen',
  'MODEL_PLACEHOLDER_M527': 'gemini-4-hydrogen',
  'MODEL_PLACEHOLDER_M528': 'gemini-4-hydrogen',
  'MODEL_PLACEHOLDER_M530': 'gemini-4-hydrogen',
  'MODEL_PLACEHOLDER_M670': 'gemini-4-carbon',
  'MODEL_PLACEHOLDER_M668': 'orchestrator-argon',

  // Gemini 3.8 Series
  'MODEL_PLACEHOLDER_M318': 'gemini-3.8-flash',
  'MODEL_PLACEHOLDER_M319': 'gemini-3.8-flash',
  'MODEL_PLACEHOLDER_M320': 'gemini-3.8-flash',
  'MODEL_PLACEHOLDER_M322': 'gemini-3.8-flash',
  'MODEL_PLACEHOLDER_M72': 'gemini-3.8-flash',
  'MODEL_PLACEHOLDER_M38': 'gemini-3.8-flash',
  'MODEL_PLACEHOLDER_M39': 'gemini-3.8-pro',
  'MODEL_PLACEHOLDER_M299': 'gemini-3.8-pro',
  'MODEL_GEMINI_3_8_FLASH': 'gemini-3.8-flash',
  'MODEL_GEMINI_3_8_PRO': 'gemini-3.8-pro',

  // Gemini 3.1 Pro
  'MODEL_PLACEHOLDER_M37': 'gemini-3.1-pro-high',
  'MODEL_PLACEHOLDER_M36': 'gemini-3.1-pro-low',
  'MODEL_GEMINI_3_1_PRO': 'gemini-3.1-pro',
  'MODEL_GEMINI_3_1_PRO_HIGH': 'gemini-3.1-pro-high',
  'MODEL_GEMINI_3_1_PRO_LOW': 'gemini-3.1-pro-low',

  // Gemini 3 Flash
  'MODEL_PLACEHOLDER_M18': 'gemini-3-flash',
  'MODEL_PLACEHOLDER_M16': 'gemini-3-flash',
  'MODEL_GEMINI_3_FLASH': 'gemini-3-flash',

  // Gemini 3 Pro (legacy, redirected to 3.1 Pro)
  'MODEL_PLACEHOLDER_M8': 'gemini-3-pro-high',
  'MODEL_PLACEHOLDER_M7': 'gemini-3-pro-low',
  'MODEL_GEMINI_3_PRO': 'gemini-3-pro',
  'MODEL_GEMINI_3_PRO_HIGH': 'gemini-3-pro-high',
  'MODEL_GEMINI_3_PRO_LOW': 'gemini-3.1-pro-low',

  // Gemini 3 Pro Image
  'MODEL_PLACEHOLDER_M9': 'gemini-3-pro-image',

  // Gemini 2.5 Series
  'MODEL_PLACEHOLDER_M24': 'gemini-2.5-flash',
  'MODEL_PLACEHOLDER_M25': 'gemini-2.5-pro',
  'MODEL_GEMINI_2_5_FLASH': 'gemini-2.5-flash',
  'MODEL_GEMINI_2_5_PRO': 'gemini-2.5-pro',
  'MODEL_GEMINI_2_5_PRO_HIGH': 'gemini-2.5-pro-high',
  'MODEL_GEMINI_2_5_PRO_LOW': 'gemini-2.5-pro-low',

  // Claude 3.7
  'MODEL_PLACEHOLDER_M33': 'claude-3-7-sonnet',
  'MODEL_CLAUDE_3_7_SONNET': 'claude-3-7-sonnet',
  'MODEL_CLAUDE_3_7_SONNET_THINKING': 'claude-3-7-sonnet-thinking',

  // Claude 3.5
  'MODEL_PLACEHOLDER_M34': 'claude-3-5-sonnet-20241022',
  'MODEL_CLAUDE_3_5_SONNET': 'claude-3-5-sonnet',
  'MODEL_CLAUDE_3_5_SONNET_20241022': 'claude-3-5-sonnet-20241022',
  'MODEL_CLAUDE_3_5_SONNET_V2': 'claude-3-5-sonnet-20241022',
  'MODEL_CLAUDE_3_5_HAIKU': 'claude-3-5-haiku',

  // Claude Opus 5.5
  'MODEL_PLACEHOLDER_M400': 'claude-opus-5-5',
  'MODEL_PLACEHOLDER_M401': 'claude-opus-5-5',
  'MODEL_PLACEHOLDER_M402': 'claude-opus-5-5',

  // Claude Sonnet 5.5
  'MODEL_PLACEHOLDER_M403': 'claude-sonnet-5-5',
  'MODEL_PLACEHOLDER_M404': 'claude-sonnet-5-5',
  'MODEL_PLACEHOLDER_M405': 'claude-sonnet-5-5',

  // Claude Opus 4.6 (Thinking)
  'MODEL_PLACEHOLDER_M26': 'claude-opus-4-6-thinking',

  // Claude Sonnet 4.6 (Thinking)
  'MODEL_PLACEHOLDER_M35': 'claude-sonnet-4-6-thinking',

  // Claude Opus 4.5 (Thinking) — legacy, redirected to Opus 4.6
  'MODEL_PLACEHOLDER_M12': 'claude-opus-4-5-thinking',

  // OpenAI Models
  'MODEL_PLACEHOLDER_M40': 'gpt-4o',
  'MODEL_OPENAI_GPT_4O': 'gpt-4o',
  'MODEL_GPT_4O': 'gpt-4o',
  'MODEL_OPENAI_GPT_4O_MINI': 'gpt-4o-mini',
  'MODEL_GPT_4O_MINI': 'gpt-4o-mini',
  'MODEL_PLACEHOLDER_M41': 'o3-mini',
  'MODEL_OPENAI_O3_MINI': 'o3-mini',
  'MODEL_O3_MINI': 'o3-mini',
  'MODEL_OPENAI_O3_MINI_HIGH': 'o3-mini-high',
  'MODEL_OPENAI_O3_MINI_MEDIUM': 'o3-mini-medium',
  'MODEL_OPENAI_O3_MINI_LOW': 'o3-mini-low',
  'MODEL_OPENAI_O1': 'o1',
  'MODEL_OPENAI_O1_MINI': 'o1-mini',

  // DeepSeek Models
  'MODEL_PLACEHOLDER_M50': 'deepseek-chat',
  'MODEL_PLACEHOLDER_M51': 'deepseek-reasoner',
  'MODEL_DEEPSEEK_CHAT': 'deepseek-chat',
  'MODEL_DEEPSEEK_V3': 'deepseek-chat',
  'MODEL_DEEPSEEK_REASONER': 'deepseek-reasoner',
  'MODEL_DEEPSEEK_R1': 'deepseek-reasoner',

  // Non-placeholder internal IDs
  'MODEL_OPENAI_GPT_OSS_120B_MEDIUM': 'gpt-oss-120b-medium',
  'MODEL_CLAUDE_4_5_SONNET': 'claude-sonnet-4-5',
  'MODEL_CLAUDE_4_5_SONNET_THINKING': 'claude-sonnet-4-5-thinking',
};

/**
 * Attempts to resolve a model placeholder string to a standard model name.
 * Returns `undefined` if the value is not a known placeholder.
 */
export function resolveModelPlaceholder(value: string): string | undefined {
  if (!value || typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (/^1[0-9]{3}$/.test(trimmed)) {
    return PLACEHOLDER_MODEL_MAP[`MODEL_PLACEHOLDER_M${Number(trimmed) - 1000}`];
  }
  return PLACEHOLDER_MODEL_MAP[trimmed];
}

/**
 * Canonicalizes any model name (including placeholder, experimental variations, and suffixes)
 * into a standard model identifier suitable for pricing lookup and category aggregation.
 */
export function canonicalizeModelId(rawModel?: string): string {
  if (!rawModel || typeof rawModel !== 'string' || !rawModel.trim()) {
    return 'gemini-3.8-flash'; // 默认回退为当前主线默认模型
  }

  const trimmed = rawModel.trim();
  const fromPlaceholder = resolveModelPlaceholder(trimmed);
  const normalized = (fromPlaceholder ?? trimmed).toLowerCase();

  // Orchestrator (Argon) — 必须在通用 gemini.*pro 判断之前识别
  if (/orchestrator|m668/i.test(normalized)) {
    return 'orchestrator-argon';
  }

  // Gemini 4 Series
  if (/gemini.*4.*argon|\bargon\b|m417|m418|m419/i.test(normalized)) {
    return 'gemini-4-argon';
  }

  if (/gemini.*4.*hydrogen|\bhydrogen\b|m525|m526|m527|m528|m530/i.test(normalized)) {
    return 'gemini-4-hydrogen';
  }

  if (/gemini.*4.*carbon|\bcarbon\b|m670/i.test(normalized)) {
    return 'gemini-4-carbon';
  }

  // Claude 5.5 Series
  if (/claude.*opus.*(5\.5|5_5|5-5)|m400|m401|m402/i.test(normalized)) {
    return 'claude-opus-5-5';
  }

  if (/claude.*sonnet.*(5\.5|5_5|5-5)|m403|m404|m405/i.test(normalized)) {
    return 'claude-sonnet-5-5';
  }

  // GPT-OSS 120B
  if (/gpt[\s._-]*oss[\s._-]*120b/i.test(normalized)) {
    return 'gpt-oss-120b-medium';
  }

  // Gemini 3.8 Flash (包含 -n, -tiered, -exp-c, 3p7, 3.6/3.7 等各种内部实验后缀)
  if (/gemini.*(3\.8|3p7|3_8|3\.7|3\.6|3\.5).*flash|m318|m319|m320|m322|m72/i.test(normalized)) {
    return 'gemini-3.8-flash';
  }

  // Gemini 3.8 Pro
  if (/gemini.*(3\.8|3_8).*pro/i.test(normalized)) {
    return 'gemini-3.8-pro';
  }

  // Gemini 3.1 Pro / Pro Default
  if (/gemini.*(3\.1|3_1).*pro/i.test(normalized) || normalized === 'gemini-pro-default') {
    return 'gemini-3.1-pro';
  }

  // Gemini 3 Flash / 3.0 Flash
  if (/gemini.*(3\.0|3_0|3).*flash/i.test(normalized)) {
    return 'gemini-3-flash';
  }

  // Gemini 2.5 Flash
  if (/gemini.*(2\.5|2_5).*flash/i.test(normalized)) {
    return 'gemini-2.5-flash';
  }

  // Gemini 2.5 Pro
  if (/gemini.*(2\.5|2_5).*pro/i.test(normalized)) {
    return 'gemini-2.5-pro';
  }

  // Claude Opus 4.6 (Thinking)
  if (/claude.*opus.*(4\.6|4_6|4\.5|4_5)/i.test(normalized)) {
    return 'claude-opus-4-6-thinking';
  }

  // Claude Sonnet 4.6 (Thinking)
  if (/claude.*sonnet.*(4\.6|4_6|4\.5|4_5)/i.test(normalized)) {
    return 'claude-sonnet-4-6-thinking';
  }

  // Claude 3.7 Sonnet
  if (/claude.*3[.\-_]7.*sonnet/i.test(normalized)) {
    return 'claude-3-7-sonnet';
  }

  // Claude 3.5 Sonnet
  if (/claude.*3[.\-_]5.*sonnet/i.test(normalized)) {
    return 'claude-3-5-sonnet-20241022';
  }

  // OpenAI
  if (/gpt.*4o.*mini/i.test(normalized)) return 'gpt-4o-mini';
  if (/gpt.*4o/i.test(normalized)) return 'gpt-4o';
  if (/o3.*mini/i.test(normalized)) return 'o3-mini';
  if (/o1.*mini/i.test(normalized)) return 'o1-mini';
  if (/^o1/i.test(normalized)) return 'o1';

  // DeepSeek
  if (/deepseek.*reasoner|deepseek.*r1/i.test(normalized)) return 'deepseek-reasoner';
  if (/deepseek.*chat|deepseek.*v3/i.test(normalized)) return 'deepseek-chat';

  if (normalized === 'unknown' || !normalized) {
    return 'gemini-3.8-flash';
  }

  return normalized;
}

/**
 * Returns a clean, user-friendly display name for the given model ID.
 */
export function formatModelDisplayName(model?: string): string {
  const canonical = canonicalizeModelId(model);

  const DISPLAY_MAP: Record<string, string> = {
    'gemini-4-argon': 'Gemini 4 Argon',
    'gemini-4-hydrogen': 'Gemini 4 Hydrogen',
    'gemini-4-carbon': 'Gemini 4 Carbon',
    'orchestrator-argon': 'Orchestrator (Argon)',
    'claude-opus-5-5': 'Claude Opus 5.5',
    'claude-sonnet-5-5': 'Claude Sonnet 5.5',
    'gpt-oss-120b-medium': 'GPT-OSS 120B (Medium)',
    'gemini-3.8-flash': 'Gemini 3.8 Flash',
    'gemini-3.8-pro': 'Gemini 3.8 Pro',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
    'gemini-3.1-pro-high': 'Gemini 3.1 Pro (High)',
    'gemini-3.1-pro-low': 'Gemini 3.1 Pro (Low)',
    'gemini-3-flash': 'Gemini 3 Flash',
    'gemini-3-pro-high': 'Gemini 3 Pro (High)',
    'gemini-3-pro-low': 'Gemini 3 Pro (Low)',
    'gemini-3-pro-image': 'Gemini 3 Pro (Image)',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'claude-opus-4-6-thinking': 'Claude Opus 4.6 (Thinking)',
    'claude-sonnet-4-6-thinking': 'Claude Sonnet 4.6 (Thinking)',
    'claude-3-7-sonnet': 'Claude 3.7 Sonnet',
    'claude-3-7-sonnet-thinking': 'Claude 3.7 Sonnet (Thinking)',
    'claude-3-5-sonnet-20241022': 'Claude 3.5 Sonnet',
    'claude-3-5-sonnet': 'Claude 3.5 Sonnet',
    'claude-3-5-haiku': 'Claude 3.5 Haiku',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'o3-mini': 'o3-mini',
    'o1': 'o1',
    'o1-mini': 'o1-mini',
    'deepseek-chat': 'DeepSeek-V3',
    'deepseek-reasoner': 'DeepSeek-R1',
  };

  return DISPLAY_MAP[canonical] ?? canonical;
}
