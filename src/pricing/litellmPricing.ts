import type { ModelTokenBreakdown } from '../types';

const DEFAULT_PRICING_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type LiteLlmModelPricing = {
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
  output_cost_per_reasoning_token?: number;
  prompt_cost_per_token?: number;
  completion_cost_per_token?: number;
  input_cost_per_token_cache_hit?: number;
};

export type LiteLlmPricingSnapshot = {
  fetchedAt: number;
  priceMap: Record<string, LiteLlmModelPricing>;
};

type PricingCacheEntry = LiteLlmPricingSnapshot & {
  exactIndex: Map<string, LiteLlmModelPricing>;
  suffixIndex: Map<string, LiteLlmModelPricing>;
};

export type ModelCostResult = {
  costUsd?: number;
  pricingStatus: 'priced' | 'unpriced';
  pricingNote?: string;
};

/**
 * Built-in baseline pricing for common Antigravity models.
 * Used as a fallback when remote LiteLLM pricing is unavailable or when the remote catalog
 * does not yet contain entries for newer models.
 */
export const BASELINE_MODEL_PRICING: Record<string, LiteLlmModelPricing> = {
  // Gemini 4 Series & Orchestrator
  'gemini-4-neon': {
    input_cost_per_token: 0.0000025,
    prompt_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    completion_cost_per_token: 0.00001,
    cache_read_input_token_cost: 0.000000625,
    input_cost_per_token_cache_hit: 0.000000625
  },
  'gemini-4-argon': {
    input_cost_per_token: 0.00000125,
    prompt_cost_per_token: 0.00000125,
    output_cost_per_token: 0.000005,
    completion_cost_per_token: 0.000005,
    cache_read_input_token_cost: 0.0000003125,
    input_cost_per_token_cache_hit: 0.0000003125
  },
  'gemini-4-hydrogen': {
    input_cost_per_token: 0.00000015,
    prompt_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006,
    completion_cost_per_token: 0.0000006,
    cache_read_input_token_cost: 0.0000000375,
    input_cost_per_token_cache_hit: 0.0000000375
  },
  'gemini-4-hydrogen-orchestrator': {
    input_cost_per_token: 0.00000015,
    prompt_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006,
    completion_cost_per_token: 0.0000006,
    cache_read_input_token_cost: 0.0000000375,
    input_cost_per_token_cache_hit: 0.0000000375
  },
  'gemini-4-carbon': {
    input_cost_per_token: 0.0000025,
    prompt_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    completion_cost_per_token: 0.00001,
    cache_read_input_token_cost: 0.000000625,
    input_cost_per_token_cache_hit: 0.000000625
  },
  'orchestrator-neon': {
    input_cost_per_token: 0.0000025,
    prompt_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    completion_cost_per_token: 0.00001,
    cache_read_input_token_cost: 0.000000625,
    input_cost_per_token_cache_hit: 0.000000625
  },
  'orchestrator-argon': {
    input_cost_per_token: 0.00000125,
    prompt_cost_per_token: 0.00000125,
    output_cost_per_token: 0.000005,
    completion_cost_per_token: 0.000005,
    cache_read_input_token_cost: 0.0000003125,
    input_cost_per_token_cache_hit: 0.0000003125
  },

  // Claude 5.5 Series
  'claude-opus-5-5': {
    input_cost_per_token: 0.000005,
    prompt_cost_per_token: 0.000005,
    output_cost_per_token: 0.000025,
    completion_cost_per_token: 0.000025,
    cache_read_input_token_cost: 0.0000005,
    input_cost_per_token_cache_hit: 0.0000005
  },
  'claude-sonnet-5-5': {
    input_cost_per_token: 0.000003,
    prompt_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    completion_cost_per_token: 0.000015,
    cache_read_input_token_cost: 0.0000003,
    input_cost_per_token_cache_hit: 0.0000003
  },

  // OpenAI GPT-OSS 120B
  'gpt-oss-120b-medium': {
    input_cost_per_token: 0.00000015,
    prompt_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006,
    completion_cost_per_token: 0.0000006,
    cache_read_input_token_cost: 0.000000075,
    input_cost_per_token_cache_hit: 0.000000075
  },

  // Gemini 3.8 Series
  'gemini-3.8-flash': {
    input_cost_per_token: 0.00000015,
    prompt_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006,
    completion_cost_per_token: 0.0000006,
    cache_read_input_token_cost: 0.0000000375,
    input_cost_per_token_cache_hit: 0.0000000375
  },
  'gemini-3.8-pro': {
    input_cost_per_token: 0.0000015,
    prompt_cost_per_token: 0.0000015,
    output_cost_per_token: 0.000006,
    completion_cost_per_token: 0.000006,
    cache_read_input_token_cost: 0.000000375,
    input_cost_per_token_cache_hit: 0.000000375
  },

  // Gemini 3 Flash & Pro
  'gemini-3-flash': {
    input_cost_per_token: 0.0000001,
    prompt_cost_per_token: 0.0000001,
    output_cost_per_token: 0.0000004,
    completion_cost_per_token: 0.0000004,
    cache_read_input_token_cost: 0.000000025,
    input_cost_per_token_cache_hit: 0.000000025
  },
  'gemini-3-pro': {
    input_cost_per_token: 0.00000125,
    prompt_cost_per_token: 0.00000125,
    output_cost_per_token: 0.000005,
    completion_cost_per_token: 0.000005,
    cache_read_input_token_cost: 0.0000003125,
    input_cost_per_token_cache_hit: 0.0000003125
  },
  'gemini-3.1-pro': {
    input_cost_per_token: 0.00000125,
    prompt_cost_per_token: 0.00000125,
    output_cost_per_token: 0.000005,
    completion_cost_per_token: 0.000005,
    cache_read_input_token_cost: 0.0000003125,
    input_cost_per_token_cache_hit: 0.0000003125
  },

  // Gemini 2.5 Series
  'gemini-2.5-flash': {
    input_cost_per_token: 0.000000075,
    prompt_cost_per_token: 0.000000075,
    output_cost_per_token: 0.0000003,
    completion_cost_per_token: 0.0000003,
    cache_read_input_token_cost: 0.00000001875,
    input_cost_per_token_cache_hit: 0.00000001875
  },
  'gemini-2.5-pro': {
    input_cost_per_token: 0.00000125,
    prompt_cost_per_token: 0.00000125,
    output_cost_per_token: 0.000005,
    completion_cost_per_token: 0.000005,
    cache_read_input_token_cost: 0.0000003125,
    input_cost_per_token_cache_hit: 0.0000003125
  },

  // Claude Series
  'claude-3-7-sonnet': {
    input_cost_per_token: 0.000003,
    prompt_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    completion_cost_per_token: 0.000015,
    cache_read_input_token_cost: 0.0000003,
    input_cost_per_token_cache_hit: 0.0000003,
    cache_creation_input_token_cost: 0.00000375,
    output_cost_per_reasoning_token: 0.000015
  },
  'claude-3-5-sonnet-20241022': {
    input_cost_per_token: 0.000003,
    prompt_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    completion_cost_per_token: 0.000015,
    cache_read_input_token_cost: 0.0000003,
    input_cost_per_token_cache_hit: 0.0000003,
    cache_creation_input_token_cost: 0.00000375
  },
  'claude-3-5-sonnet': {
    input_cost_per_token: 0.000003,
    prompt_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    completion_cost_per_token: 0.000015,
    cache_read_input_token_cost: 0.0000003,
    input_cost_per_token_cache_hit: 0.0000003,
    cache_creation_input_token_cost: 0.00000375
  },
  'claude-3-5-haiku': {
    input_cost_per_token: 0.0000008,
    prompt_cost_per_token: 0.0000008,
    output_cost_per_token: 0.000004,
    completion_cost_per_token: 0.000004,
    cache_read_input_token_cost: 0.00000008,
    input_cost_per_token_cache_hit: 0.00000008,
    cache_creation_input_token_cost: 0.000001
  },
  'claude-opus-4-6': {
    input_cost_per_token: 0.000005,
    prompt_cost_per_token: 0.000005,
    output_cost_per_token: 0.000025,
    completion_cost_per_token: 0.000025,
    cache_read_input_token_cost: 0.0000005,
    input_cost_per_token_cache_hit: 0.0000005
  },
  'claude-sonnet-4-6': {
    input_cost_per_token: 0.000003,
    prompt_cost_per_token: 0.000003,
    output_cost_per_token: 0.000015,
    completion_cost_per_token: 0.000015,
    cache_read_input_token_cost: 0.0000003,
    input_cost_per_token_cache_hit: 0.0000003
  },

  // OpenAI Series
  'gpt-4o': {
    input_cost_per_token: 0.0000025,
    prompt_cost_per_token: 0.0000025,
    output_cost_per_token: 0.00001,
    completion_cost_per_token: 0.00001,
    cache_read_input_token_cost: 0.00000125,
    input_cost_per_token_cache_hit: 0.00000125
  },
  'gpt-4o-mini': {
    input_cost_per_token: 0.00000015,
    prompt_cost_per_token: 0.00000015,
    output_cost_per_token: 0.0000006,
    completion_cost_per_token: 0.0000006,
    cache_read_input_token_cost: 0.000000075,
    input_cost_per_token_cache_hit: 0.000000075
  },
  'o3-mini': {
    input_cost_per_token: 0.0000011,
    prompt_cost_per_token: 0.0000011,
    output_cost_per_token: 0.0000044,
    completion_cost_per_token: 0.0000044,
    cache_read_input_token_cost: 0.00000055,
    input_cost_per_token_cache_hit: 0.00000055,
    output_cost_per_reasoning_token: 0.0000044
  },
  'o1': {
    input_cost_per_token: 0.000015,
    prompt_cost_per_token: 0.000015,
    output_cost_per_token: 0.00006,
    completion_cost_per_token: 0.00006,
    cache_read_input_token_cost: 0.0000075,
    input_cost_per_token_cache_hit: 0.0000075,
    output_cost_per_reasoning_token: 0.00006
  },
  'o1-mini': {
    input_cost_per_token: 0.0000011,
    prompt_cost_per_token: 0.0000011,
    output_cost_per_token: 0.0000044,
    completion_cost_per_token: 0.0000044,
    cache_read_input_token_cost: 0.00000055,
    input_cost_per_token_cache_hit: 0.00000055,
    output_cost_per_reasoning_token: 0.0000044
  },

  // DeepSeek Series
  'deepseek-chat': {
    input_cost_per_token: 0.00000027,
    prompt_cost_per_token: 0.00000027,
    output_cost_per_token: 0.0000011,
    completion_cost_per_token: 0.0000011,
    cache_read_input_token_cost: 0.00000007,
    input_cost_per_token_cache_hit: 0.00000007
  },
  'deepseek-v3': {
    input_cost_per_token: 0.00000027,
    prompt_cost_per_token: 0.00000027,
    output_cost_per_token: 0.0000011,
    completion_cost_per_token: 0.0000011,
    cache_read_input_token_cost: 0.00000007,
    input_cost_per_token_cache_hit: 0.00000007
  },
  'deepseek-reasoner': {
    input_cost_per_token: 0.00000055,
    prompt_cost_per_token: 0.00000055,
    output_cost_per_token: 0.00000219,
    completion_cost_per_token: 0.00000219,
    cache_read_input_token_cost: 0.00000014,
    input_cost_per_token_cache_hit: 0.00000014,
    output_cost_per_reasoning_token: 0.00000219
  },
  'deepseek-r1': {
    input_cost_per_token: 0.00000055,
    prompt_cost_per_token: 0.00000055,
    output_cost_per_token: 0.00000219,
    completion_cost_per_token: 0.00000219,
    cache_read_input_token_cost: 0.00000014,
    input_cost_per_token_cache_hit: 0.00000014,
    output_cost_per_reasoning_token: 0.00000219
  }
};

export class LiteLlmPricingCatalog {
  private cache: PricingCacheEntry | undefined;
  private inFlight: Promise<LiteLlmPricingSnapshot> | undefined;
  private readonly baselineExactIndex: Map<string, LiteLlmModelPricing>;
  private readonly baselineSuffixIndex: Map<string, LiteLlmModelPricing>;

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly pricingUrl: string = DEFAULT_PRICING_URL,
    private readonly ttlMs: number = DEFAULT_CACHE_TTL_MS,
    private readonly now: () => number = () => Date.now(),
    baselinePricing: Record<string, LiteLlmModelPricing> = BASELINE_MODEL_PRICING
  ) {
    const parsedBaseline = parseLiteLlmPriceMap(baselinePricing);
    this.baselineExactIndex = buildExactIndex(parsedBaseline);
    this.baselineSuffixIndex = buildSuffixIndex(parsedBaseline);
  }

  async getSnapshot(): Promise<LiteLlmPricingSnapshot> {
    if (this.cache && this.now() - this.cache.fetchedAt < this.ttlMs) {
      return { fetchedAt: this.cache.fetchedAt, priceMap: this.cache.priceMap };
    }

    if (!this.inFlight) {
      this.inFlight = this.fetchSnapshot();
    }

    try {
      return await this.inFlight;
    } finally {
      this.inFlight = undefined;
    }
  }

  resolveModelPricing(model: string): LiteLlmModelPricing | undefined {
    const aliases = buildModelAliases(model);

    // 1. Try remote cache first if available
    if (this.cache) {
      for (const alias of aliases) {
        const exactMatch = this.cache.exactIndex.get(alias);
        if (exactMatch) {
          return exactMatch;
        }
      }

      for (const alias of aliases) {
        const suffixMatch = this.cache.suffixIndex.get(alias);
        if (suffixMatch) {
          return suffixMatch;
        }
      }
    }

    // 2. Fallback to baseline pricing catalog
    for (const alias of aliases) {
      const exactMatch = this.baselineExactIndex.get(alias);
      if (exactMatch) {
        return exactMatch;
      }
    }

    for (const alias of aliases) {
      const suffixMatch = this.baselineSuffixIndex.get(alias);
      if (suffixMatch) {
        return suffixMatch;
      }
    }

    return undefined;
  }

  private async fetchSnapshot(): Promise<LiteLlmPricingSnapshot> {
    const response = await this.fetchImpl(this.pricingUrl);
    if (!response.ok) {
      throw new Error(`LiteLLM pricing fetch failed with status ${response.status}.`);
    }

    const parsed = await response.json() as unknown;
    const priceMap = parseLiteLlmPriceMap(parsed);
    const fetchedAt = this.now();
    this.cache = {
      fetchedAt,
      priceMap,
      exactIndex: buildExactIndex(priceMap),
      suffixIndex: buildSuffixIndex(priceMap)
    };

    return { fetchedAt, priceMap };
  }
}

export function calculateModelCost(
  breakdown: ModelTokenBreakdown | undefined,
  pricing: LiteLlmModelPricing | undefined,
  unavailableNote: string
): ModelCostResult {
  if (!breakdown) {
    return { pricingStatus: 'unpriced', pricingNote: 'Per-model token breakdown unavailable.' };
  }

  if (!pricing) {
    return { pricingStatus: 'unpriced', pricingNote: unavailableNote };
  }

  const inputCost = pricing.input_cost_per_token ?? pricing.prompt_cost_per_token;
  const outputCost = pricing.output_cost_per_token ?? pricing.completion_cost_per_token;
  const cacheReadCost = pricing.cache_read_input_token_cost ?? pricing.input_cost_per_token_cache_hit ?? inputCost;
  const cacheWriteCost = pricing.cache_creation_input_token_cost ?? inputCost;
  const reasoningCost = pricing.output_cost_per_reasoning_token ?? outputCost;

  if (inputCost === undefined && outputCost === undefined && reasoningCost === undefined) {
    return { pricingStatus: 'unpriced', pricingNote: unavailableNote };
  }

  const costUsd = (breakdown.inputTokens * (inputCost ?? 0))
    + (breakdown.outputTokens * (outputCost ?? 0))
    + (breakdown.cacheReadTokens * (cacheReadCost ?? 0))
    + (breakdown.cacheWriteTokens * (cacheWriteCost ?? 0))
    + (breakdown.reasoningTokens * (reasoningCost ?? 0));

  return { costUsd, pricingStatus: 'priced' };
}

export function parseLiteLlmPriceMap(input: unknown): Record<string, LiteLlmModelPricing> {
  if (!input || typeof input !== 'object') {
    throw new Error('LiteLLM pricing payload is not an object.');
  }

  const priceMap: Record<string, LiteLlmModelPricing> = {};
  for (const [model, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (model === 'sample_spec' || !rawValue || typeof rawValue !== 'object') {
      continue;
    }

    const pricing = rawValue as Record<string, unknown>;
    priceMap[model] = {
      input_cost_per_token: toFiniteNumber(pricing.input_cost_per_token ?? pricing.prompt_cost_per_token),
      output_cost_per_token: toFiniteNumber(pricing.output_cost_per_token ?? pricing.completion_cost_per_token),
      cache_read_input_token_cost: toFiniteNumber(pricing.cache_read_input_token_cost ?? pricing.input_cost_per_token_cache_hit),
      cache_creation_input_token_cost: toFiniteNumber(pricing.cache_creation_input_token_cost),
      output_cost_per_reasoning_token: toFiniteNumber(pricing.output_cost_per_reasoning_token)
    };
  }

  return priceMap;
}

function buildExactIndex(priceMap: Record<string, LiteLlmModelPricing>): Map<string, LiteLlmModelPricing> {
  const exactIndex = new Map<string, LiteLlmModelPricing>();
  for (const [model, pricing] of Object.entries(priceMap)) {
    const normalized = normalizeModelKey(model);
    if (!exactIndex.has(normalized)) {
      exactIndex.set(normalized, pricing);
    }

    if (normalized.startsWith('models/')) {
      const unwrapped = normalized.slice('models/'.length);
      if (!exactIndex.has(unwrapped)) {
        exactIndex.set(unwrapped, pricing);
      }
    }
  }
  return exactIndex;
}

function buildSuffixIndex(priceMap: Record<string, LiteLlmModelPricing>): Map<string, LiteLlmModelPricing> {
  const grouped = new Map<string, LiteLlmModelPricing[]>();
  for (const [model, pricing] of Object.entries(priceMap)) {
    const normalized = normalizeModelKey(model);
    if (!normalized.includes('/')) {
      continue;
    }

    const suffix = normalized.split('/').at(-1);
    if (!suffix) {
      continue;
    }

    const existing = grouped.get(suffix) ?? [];
    existing.push(pricing);
    grouped.set(suffix, existing);
  }

  const suffixIndex = new Map<string, LiteLlmModelPricing>();
  for (const [suffix, matches] of grouped.entries()) {
    if (matches.length === 1) {
      suffixIndex.set(suffix, matches[0]);
    }
  }

  return suffixIndex;
}

function buildModelAliases(model: string): string[] {
  const normalized = normalizeModelKey(model);
  if (!normalized) {
    return [];
  }

  const aliases = new Set<string>([normalized]);
  const trimmedQuality = normalized.replace(/-(high|low|c)$/u, '');
  aliases.add(trimmedQuality);
  aliases.add(trimmedQuality.replace(/-(thinking|medium)$/u, ''));

  if (normalized.startsWith('models/')) {
    aliases.add(normalized.slice('models/'.length));
  }

  if (trimmedQuality.startsWith('models/')) {
    aliases.add(trimmedQuality.slice('models/'.length));
  }

  const unwrappedBase = trimmedQuality.replace(/-(thinking|medium)$/u, '');
  if (unwrappedBase.startsWith('models/')) {
    aliases.add(unwrappedBase.slice('models/'.length));
  }

  if (normalized.includes('/')) {
    aliases.add(normalized.split('/').at(-1) ?? normalized);
  }

  if (trimmedQuality.includes('/')) {
    aliases.add(trimmedQuality.split('/').at(-1) ?? trimmedQuality);
  }

  if (unwrappedBase.includes('/')) {
    aliases.add(unwrappedBase.split('/').at(-1) ?? unwrappedBase);
  }

  const bareBase = (unwrappedBase.includes('/') ? unwrappedBase.split('/').at(-1) : unwrappedBase) ?? unwrappedBase;

  // Gemini previews
  if (/^gemini-(?:2\.5|3(?:\.[0-9]+)?)(?:-|$)/u.test(trimmedQuality) && !trimmedQuality.endsWith('-preview')) {
    aliases.add(`${trimmedQuality}-preview`);
  }

  // Claude 3.7
  if (/^claude-3[-.]7-sonnet(?:-[0-9]{8})?$/u.test(bareBase)) {
    aliases.add('claude-3-7-sonnet');
    aliases.add('claude-3.7-sonnet');
    aliases.add('claude-3-7-sonnet-20250219');
    aliases.add('anthropic/claude-3-7-sonnet');
  }

  // Claude 3.5
  if (/^claude-3[-.]5-sonnet(?:-(?:20241022|latest))?$/u.test(bareBase)) {
    aliases.add('claude-3-5-sonnet');
    aliases.add('claude-3.5-sonnet');
    aliases.add('claude-3-5-sonnet-20241022');
    aliases.add('claude-3-5-sonnet-latest');
    aliases.add('anthropic/claude-3-5-sonnet-20241022');
  }

  if (/^claude-3[-.]5-haiku(?:-(?:20241022|latest))?$/u.test(bareBase)) {
    aliases.add('claude-3-5-haiku');
    aliases.add('claude-3.5-haiku');
    aliases.add('claude-3-5-haiku-20241022');
    aliases.add('anthropic/claude-3-5-haiku-20241022');
  }

  // OpenAI Models
  if (/^gpt-4o(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?$/u.test(bareBase)) {
    aliases.add('gpt-4o');
    aliases.add('openai/gpt-4o');
  }

  if (/^gpt-4o-mini(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?$/u.test(bareBase)) {
    aliases.add('gpt-4o-mini');
    aliases.add('openai/gpt-4o-mini');
  }

  if (/^o3-mini(?:-(?:high|medium|low))?$/u.test(bareBase)) {
    aliases.add('o3-mini');
    aliases.add('openai/o3-mini');
  }

  if (bareBase === 'o1' || bareBase === 'openai/o1') {
    aliases.add('o1');
    aliases.add('openai/o1');
  }

  if (bareBase === 'o1-mini' || bareBase === 'openai/o1-mini') {
    aliases.add('o1-mini');
    aliases.add('openai/o1-mini');
  }

  // DeepSeek Chat / V3
  if (bareBase === 'deepseek-v3' || bareBase === 'deepseek-chat') {
    aliases.add('deepseek-chat');
    aliases.add('deepseek-v3');
    aliases.add('deepseek/deepseek-chat');
  }

  // DeepSeek Reasoner / R1
  if (bareBase === 'deepseek-r1' || bareBase === 'deepseek-reasoner') {
    aliases.add('deepseek-reasoner');
    aliases.add('deepseek-r1');
    aliases.add('deepseek/deepseek-reasoner');
  }

  if (/^gpt-oss-120b(?:-(medium|high|low))?$/u.test(trimmedQuality)) {
    aliases.add('openai.gpt-oss-120b-1:0');
  }

  return Array.from(aliases);
}

function normalizeModelKey(value: string): string {
  return value.trim().toLowerCase();
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}
