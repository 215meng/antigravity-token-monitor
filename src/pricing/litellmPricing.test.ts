import { describe, expect, it, vi } from 'vitest';
import { calculateModelCost, LiteLlmPricingCatalog, parseLiteLlmPriceMap, BASELINE_MODEL_PRICING } from './litellmPricing';

describe('litellmPricing', () => {
  it('parses pricing payloads and skips sample_spec', () => {
    expect(parseLiteLlmPriceMap({
      sample_spec: { input_cost_per_token: 99 },
      'openai/gpt-4o-mini': {
        input_cost_per_token: 0.000001,
        output_cost_per_token: 0.000002
      }
    })).toEqual({
      'openai/gpt-4o-mini': {
        input_cost_per_token: 0.000001,
        output_cost_per_token: 0.000002,
        cache_read_input_token_cost: undefined,
        cache_creation_input_token_cost: undefined,
        output_cost_per_reasoning_token: undefined
      }
    });
  });

  it('parses pricing payloads with prompt_cost_per_token, completion_cost_per_token, and cache_hit aliases', () => {
    const parsed = parseLiteLlmPriceMap({
      'custom/model-alias': {
        prompt_cost_per_token: 0.000003,
        completion_cost_per_token: 0.000015,
        input_cost_per_token_cache_hit: 0.0000003,
        cache_creation_input_token_cost: 0.00000375,
        output_cost_per_reasoning_token: 0.000015
      }
    });

    expect(parsed['custom/model-alias']).toEqual({
      input_cost_per_token: 0.000003,
      output_cost_per_token: 0.000015,
      cache_read_input_token_cost: 0.0000003,
      cache_creation_input_token_cost: 0.00000375,
      output_cost_per_reasoning_token: 0.000015
    });
  });

  it('calculates cost from token categories and flags unknown pricing', () => {
    const priced = calculateModelCost({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
      reasoningTokens: 20,
      totalTokens: 185
    }, {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      cache_read_input_token_cost: 0.0000005,
      cache_creation_input_token_cost: 0.000001,
      output_cost_per_reasoning_token: 0.000003
    }, 'No LiteLLM pricing match.');

    expect(priced.pricingStatus).toBe('priced');
    expect(priced.costUsd).toBeCloseTo(0.000275);

    expect(calculateModelCost(undefined, undefined, 'No LiteLLM pricing match.')).toEqual({
      pricingStatus: 'unpriced',
      pricingNote: 'Per-model token breakdown unavailable.'
    });
  });

  it('calculates cost using prompt_cost_per_token and completion_cost_per_token aliases', () => {
    const priced = calculateModelCost({
      inputTokens: 100,
      outputTokens: 50,
      cacheReadTokens: 10,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalTokens: 160
    }, {
      prompt_cost_per_token: 0.000003,
      completion_cost_per_token: 0.000015,
      input_cost_per_token_cache_hit: 0.0000003
    }, 'No LiteLLM pricing match.');

    expect(priced.pricingStatus).toBe('priced');
    // 100 * 0.000003 + 50 * 0.000015 + 10 * 0.0000003 = 0.0003 + 0.00075 + 0.000003 = 0.001053
    expect(priced.costUsd).toBeCloseTo(0.001053);
  });

  it('caches remote pricing until ttl expiry', async () => {
    const fetchImpl: typeof fetch = vi.fn(async () => new Response(JSON.stringify({
      'openai/gpt-4o-mini': { input_cost_per_token: 0.000001 }
    }), { status: 200 }));
    let now = 1000;
    const catalog = new LiteLlmPricingCatalog(fetchImpl, 'https://example.test/pricing.json', 1000, () => now);

    const first = await catalog.getSnapshot();
    const second = await catalog.getSnapshot();
    now = 2501;
    const third = await catalog.getSnapshot();

    expect(first.priceMap['openai/gpt-4o-mini']?.input_cost_per_token).toBe(0.000001);
    expect(second.fetchedAt).toBe(first.fetchedAt);
    expect(third.fetchedAt).toBe(now);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('resolves provider-qualified pricing from common model aliases', async () => {
    const catalog = new LiteLlmPricingCatalog(async () => new Response(JSON.stringify({
      'vertex_ai/gemini-2.5-pro': { input_cost_per_token: 0.000001 }
    }), { status: 200 }), 'https://example.test/pricing.json');

    await catalog.getSnapshot();

    expect(catalog.resolveModelPricing('models/gemini-2.5-pro')?.input_cost_per_token).toBe(0.000001);
    expect(catalog.resolveModelPricing('gemini-2.5-pro')?.input_cost_per_token).toBe(0.000001);
  });

  it('resolves Antigravity Gemini aliases to LiteLLM preview entries', async () => {
    const catalog = new LiteLlmPricingCatalog(async () => new Response(JSON.stringify({
      'gemini-3.1-pro-preview': { input_cost_per_token: 0.00001 },
      'gemini-3-flash-preview': { input_cost_per_token: 0.000001 }
    }), { status: 200 }), 'https://example.test/pricing.json');

    await catalog.getSnapshot();

    expect(catalog.resolveModelPricing('gemini-3.1-pro-high')?.input_cost_per_token).toBe(0.00001);
    expect(catalog.resolveModelPricing('gemini-3-flash')?.input_cost_per_token).toBe(0.000001);
    expect(catalog.resolveModelPricing('gemini-3-flash-c')?.input_cost_per_token).toBe(0.000001);
  });

  it('does not resolve ambiguous bare suffix aliases across providers', async () => {
    const catalog = new LiteLlmPricingCatalog(async () => new Response(JSON.stringify({
      'openai/foo': { input_cost_per_token: 0.000001 },
      'azure/foo': { input_cost_per_token: 0.000002 }
    }), { status: 200 }), 'https://example.test/pricing.json');

    await catalog.getSnapshot();

    expect(catalog.resolveModelPricing('foo')).toBeUndefined();
    expect(catalog.resolveModelPricing('openai/foo')?.input_cost_per_token).toBe(0.000001);
    expect(catalog.resolveModelPricing('azure/foo')?.input_cost_per_token).toBe(0.000002);
  });

  it('resolves safe bare aliases for thinking-tier model names', async () => {
    const catalog = new LiteLlmPricingCatalog(async () => new Response(JSON.stringify({
      'claude-opus-4-6': { input_cost_per_token: 0.000005 },
      'azure_ai/gpt-oss-120b': { input_cost_per_token: 0.000001 },
      'groq/openai/gpt-oss-120b': { input_cost_per_token: 0.000002 },
      'openai.gpt-oss-120b-1:0': { input_cost_per_token: 0.000003 }
    }), { status: 200 }), 'https://example.test/pricing.json');

    await catalog.getSnapshot();

    expect(catalog.resolveModelPricing('claude-opus-4-6-thinking')?.input_cost_per_token).toBe(0.000005);
    expect(catalog.resolveModelPricing('gpt-oss-120b-medium')?.input_cost_per_token).toBe(0.000003);
  });

  it('falls back to baseline pricing for modern models without remote pricing', () => {
    const catalog = new LiteLlmPricingCatalog();

    // Gemini 3.8 & 3 series
    const gemini38 = catalog.resolveModelPricing('gemini-3.8-flash');
    expect(gemini38).toBeDefined();
    expect(gemini38?.input_cost_per_token).toBe(0.00000015);
    expect(gemini38?.output_cost_per_token).toBe(0.0000006);

    const gemini3Pro = catalog.resolveModelPricing('gemini-3-pro');
    expect(gemini3Pro).toBeDefined();
    expect(gemini3Pro?.input_cost_per_token).toBe(0.00000125);

    // Gemini 2.5 series
    const gemini25Flash = catalog.resolveModelPricing('gemini-2.5-flash');
    expect(gemini25Flash?.input_cost_per_token).toBe(0.000000075);

    const gemini25Pro = catalog.resolveModelPricing('gemini-2.5-pro');
    expect(gemini25Pro?.input_cost_per_token).toBe(0.00000125);

    // Claude 3.7 & 3.5 series
    const claude37 = catalog.resolveModelPricing('claude-3-7-sonnet');
    expect(claude37?.input_cost_per_token).toBe(0.000003);
    expect(claude37?.output_cost_per_token).toBe(0.000015);

    const claude37Thinking = catalog.resolveModelPricing('claude-3-7-sonnet-thinking');
    expect(claude37Thinking?.input_cost_per_token).toBe(0.000003);

    const claude37Dot = catalog.resolveModelPricing('claude-3.7-sonnet');
    expect(claude37Dot?.input_cost_per_token).toBe(0.000003);

    const claude35Dated = catalog.resolveModelPricing('claude-3-5-sonnet-20241022');
    expect(claude35Dated?.input_cost_per_token).toBe(0.000003);

    // OpenAI models
    const gpt4o = catalog.resolveModelPricing('gpt-4o');
    expect(gpt4o?.input_cost_per_token).toBe(0.0000025);
    expect(gpt4o?.output_cost_per_token).toBe(0.00001);

    const o3Mini = catalog.resolveModelPricing('o3-mini');
    expect(o3Mini?.input_cost_per_token).toBe(0.0000011);
    expect(o3Mini?.output_cost_per_token).toBe(0.0000044);

    const o3MiniHigh = catalog.resolveModelPricing('o3-mini-high');
    expect(o3MiniHigh?.input_cost_per_token).toBe(0.0000011);

    // DeepSeek models
    const deepseekChat = catalog.resolveModelPricing('deepseek-chat');
    expect(deepseekChat?.input_cost_per_token).toBe(0.00000027);

    const deepseekV3 = catalog.resolveModelPricing('deepseek-v3');
    expect(deepseekV3?.input_cost_per_token).toBe(0.00000027);

    const deepseekReasoner = catalog.resolveModelPricing('deepseek-reasoner');
    expect(deepseekReasoner?.input_cost_per_token).toBe(0.00000055);

    const deepseekR1 = catalog.resolveModelPricing('deepseek-r1');
    expect(deepseekR1?.input_cost_per_token).toBe(0.00000055);
  });

  it('prefers remote pricing when available over baseline catalog', async () => {
    const catalog = new LiteLlmPricingCatalog(async () => new Response(JSON.stringify({
      'gpt-4o': { input_cost_per_token: 0.0000099 }
    }), { status: 200 }), 'https://example.test/pricing.json');

    await catalog.getSnapshot();

    expect(catalog.resolveModelPricing('gpt-4o')?.input_cost_per_token).toBe(0.0000099);
    // Models not in remote fetch still resolve via baseline
    expect(catalog.resolveModelPricing('gemini-3.8-flash')?.input_cost_per_token).toBe(0.00000015);
  });

  it('exports BASELINE_MODEL_PRICING with prompt_cost_per_token and completion_cost_per_token fields', () => {
    expect(BASELINE_MODEL_PRICING['gemini-3.8-flash'].prompt_cost_per_token).toBe(0.00000015);
    expect(BASELINE_MODEL_PRICING['gemini-3.8-flash'].completion_cost_per_token).toBe(0.0000006);
    expect(BASELINE_MODEL_PRICING['gemini-3.8-flash'].input_cost_per_token_cache_hit).toBe(0.0000000375);

    expect(BASELINE_MODEL_PRICING['claude-3-7-sonnet'].prompt_cost_per_token).toBe(0.000003);
    expect(BASELINE_MODEL_PRICING['claude-3-7-sonnet'].completion_cost_per_token).toBe(0.000015);

    expect(BASELINE_MODEL_PRICING['deepseek-chat'].prompt_cost_per_token).toBe(0.00000027);
    expect(BASELINE_MODEL_PRICING['o3-mini'].prompt_cost_per_token).toBe(0.0000011);
  });

  it('provides baseline pricing and cost calculation for Gemini 4 Neon, Orchestrator (Neon), and Orchestrator Worker', () => {
    const catalog = new LiteLlmPricingCatalog();

    const neon = catalog.resolveModelPricing('gemini-4-neon');
    expect(neon).toBeDefined();
    expect(neon?.input_cost_per_token).toBe(0.0000025);
    expect(neon?.output_cost_per_token).toBe(0.00001);

    const orchNeon = catalog.resolveModelPricing('orchestrator-neon');
    expect(orchNeon).toBeDefined();
    expect(orchNeon?.input_cost_per_token).toBe(0.0000025);

    const hydrogenOrch = catalog.resolveModelPricing('gemini-4-hydrogen-orchestrator');
    expect(hydrogenOrch).toBeDefined();
    expect(hydrogenOrch?.input_cost_per_token).toBe(0.00000015);
    expect(hydrogenOrch?.output_cost_per_token).toBe(0.0000006);

    const cost = calculateModelCost(
      { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 10000, cacheWriteTokens: 0, reasoningTokens: 50, totalTokens: 11150 },
      neon,
      'Unpriced'
    );
    expect(cost.pricingStatus).toBe('priced');
    expect(cost.costUsd).toBeCloseTo(1000 * 0.0000025 + 150 * 0.00001 + 10000 * 0.000000625);
  });
});
