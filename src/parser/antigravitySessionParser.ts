import * as fs from 'fs/promises';
import * as path from 'path';
import { canonicalizeModelId, resolveModelPlaceholder } from '../modelAliases';
import { DailyTokenBreakdown, ModelTokenBreakdown, SessionParsePlan, SessionTotals, TokenBreakdown } from '../types';

const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.md', '.txt', '.log', '.yaml', '.yml']);
const LABEL_FILES = ['task.md', 'implementation_plan.md', 'walkthrough.md'];

type CanonicalUsageEntry = ExtractedCanonicalUsage & {
  dateKey?: string;
};

type StructuredSignalResult = {
  breakdown: TokenBreakdown;
  hits: number;
  text: string;
  messageCount: number;
  modelTotals: Record<string, number>;
  modelBreakdowns: Record<string, ModelTokenBreakdown>;
  usageEntries: CanonicalUsageEntry[];
  stepTimestampByIndex: Map<number, number>;
};

export class AntigravitySessionParser {
  constructor(private readonly maxFileBytes: number) {}

  async parse(candidate: SessionParsePlan): Promise<SessionTotals> {
    const reported: TokenBreakdown = emptyBreakdown();
    const modelTotals: Record<string, number> = {};
    const modelBreakdowns: Record<string, ModelTokenBreakdown> = {};
    const usageEntries: CanonicalUsageEntry[] = [];
    const stepTimestampByIndex = new Map<number, number>();
    let messageCount = 0;
    let evidenceCount = 0;
    let estimatedText = '';
    let hasAuthoritativeUsageFile = false;
    const orderedPaths = [...candidate.tokenFilePaths].sort((a, b) => {
      const aUsage = path.basename(a).toLowerCase() === 'usage.jsonl' ? 0 : 1;
      const bUsage = path.basename(b).toLowerCase() === 'usage.jsonl' ? 0 : 1;
      return aUsage - bUsage;
    });

    for (const filePath of orderedPaths) {
      const parsed = await this.readFileContent(filePath);
      if (!parsed) {
        continue;
      }

      const { content } = parsed;
      const ext = path.extname(filePath).toLowerCase();
      const baseName = path.basename(filePath).toLowerCase();
      if (ext === '.json' || ext === '.jsonl') {
        const {
          breakdown,
          hits,
          text,
          messageCount: parsedMessageCount,
          modelTotals: parsedModelTotals,
          modelBreakdowns: parsedModelBreakdowns,
          usageEntries: parsedUsageEntries,
          stepTimestampByIndex: parsedStepTimestamps
        } = extractStructuredSignals(content, ext);
        messageCount += parsedMessageCount;
        for (const [stepIdx, ts] of parsedStepTimestamps.entries()) {
          stepTimestampByIndex.set(stepIdx, ts);
        }
        // 若已有 usage.jsonl 结构化用量，steps.jsonl 仅贡献消息数与单步时间戳，严禁重复叠加其中嵌入的 usage
        if (baseName === 'steps.jsonl' && hasAuthoritativeUsageFile) {
          continue;
        }
        if (baseName === 'usage.jsonl' && hits > 0) {
          hasAuthoritativeUsageFile = true;
        }
        mergeBreakdown(reported, breakdown);
        mergeModelTotals(modelTotals, parsedModelTotals);
        mergeModelBreakdowns(modelBreakdowns, parsedModelBreakdowns);
        usageEntries.push(...parsedUsageEntries);
        evidenceCount += hits;
        estimatedText += text;
      } else {
        estimatedText += `\n${content}`;
      }
    }

    const label = await this.resolveLabel(candidate);
    const dailyBreakdowns = buildDailyBreakdownsFromEntries(usageEntries, stepTimestampByIndex, candidate.lastModifiedMs);
    return evidenceCount > 0
      ? finalizeReported(candidate, label, reported, modelTotals, modelBreakdowns, evidenceCount, messageCount, dailyBreakdowns)
      : finalizeEstimated(candidate, label, estimatedText, messageCount);
  }

  private async resolveLabel(candidate: SessionParsePlan): Promise<string> {
    for (const labelFile of LABEL_FILES) {
      const filePath = path.join(candidate.sessionDir, labelFile);
      const content = await this.readFileContent(filePath);
      if (!content) {
        continue;
      }

      const headingMatch = content.content.match(/^#\s*(?:Task:?\s*)?(.+)$/im);
      if (headingMatch?.[1]) {
        return headingMatch[1].trim();
      }
    }

    return candidate.labelHint;
  }

  private async readFileContent(filePath: string): Promise<{ content: string } | null> {
    const ext = path.extname(filePath).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      return null;
    }

    try {
      const stat = await fs.stat(filePath);
      if (stat.size > this.maxFileBytes) {
        return null;
      }

      return { content: await fs.readFile(filePath, 'utf8') };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        console.warn(`[antigravity-token-monitor] Failed to read ${filePath}:`, error);
      }
      return null;
    }
  }
}

function extractStructuredSignals(content: string, ext: string): StructuredSignalResult {
  const breakdown = emptyBreakdown();
  let hits = 0;
  let messageCount = 0;
  let extractedText = '';
  const modelTotals: Record<string, number> = {};
  const modelBreakdowns: Record<string, ModelTokenBreakdown> = {};
  const usageEntries: CanonicalUsageEntry[] = [];
  const stepTimestampByIndex = new Map<number, number>();

  if (ext === '.jsonl') {
    const lines = content.split(/\r?\n/);
    const seenRequestIds = new Set<string>();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      extractedText += `\n${trimmed}`;
      try {
        const parsed = JSON.parse(trimmed) as any;
        messageCount += countStepRows(parsed);
        collectStepTimestamp(parsed, stepTimestampByIndex);

        if (parsed && typeof parsed === 'object' && parsed.recordType === 'usage') {
          const extracted = extractCanonicalUsageFields(parsed);
          if (!extracted) {
            continue;
          }
          if (extracted.requestId) {
            if (seenRequestIds.has(extracted.requestId)) {
              continue;
            }
            seenRequestIds.add(extracted.requestId);
          }
          if (extracted.breakdown.totalTokens > 0) {
            usageEntries.push(extracted);
          }
          const canonical = toCanonicalSignalResult(extracted);
          mergeBreakdown(breakdown, canonical.breakdown);
          mergeModelTotals(modelTotals, canonical.modelTotals);
          mergeModelBreakdowns(modelBreakdowns, canonical.modelBreakdowns);
          hits += canonical.hits;
        } else {
          const signal = walkForTokenSignals(parsed);
          mergeBreakdown(breakdown, signal.breakdown);
          mergeModelTotals(modelTotals, signal.modelTotals);
          mergeModelBreakdowns(modelBreakdowns, signal.modelBreakdowns);
          hits += signal.hits;
        }
      } catch {
      }
    }

    return { breakdown, hits, text: extractedText, messageCount, modelTotals, modelBreakdowns, usageEntries, stepTimestampByIndex };
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return { breakdown, hits, text: extractedText, messageCount, modelTotals, modelBreakdowns, usageEntries, stepTimestampByIndex };
  }

  extractedText += `\n${trimmed}`;
  try {
    const parsed = JSON.parse(content) as unknown;
    messageCount = countMessages(parsed);
    const signal = walkForTokenSignals(parsed);
    mergeBreakdown(breakdown, signal.breakdown);
    mergeModelTotals(modelTotals, signal.modelTotals);
    mergeModelBreakdowns(modelBreakdowns, signal.modelBreakdowns);
    hits += signal.hits;
  } catch {
  }

  return { breakdown, hits, text: extractedText, messageCount, modelTotals, modelBreakdowns, usageEntries, stepTimestampByIndex };
}

type SignalResult = {
  breakdown: TokenBreakdown;
  hits: number;
  modelTotals: Record<string, number>;
  modelBreakdowns: Record<string, ModelTokenBreakdown>;
};

function walkForTokenSignals(value: unknown): SignalResult {
  const breakdown = emptyBreakdown();
  let hits = 0;
  const modelTotals: Record<string, number> = {};
  const modelBreakdowns: Record<string, ModelTokenBreakdown> = {};

  const visit = (input: unknown, inheritedModel?: string): void => {
    if (Array.isArray(input)) {
      input.forEach((item) => {
        visit(item, inheritedModel);
      });
      return;
    }

    if (!input || typeof input !== 'object') {
      return;
    }

    const record = input as Record<string, unknown>;
    const usageSignal = extractCanonicalUsageSignal(record, inheritedModel);
    if (usageSignal) {
      mergeBreakdown(breakdown, usageSignal.breakdown);
      mergeModelTotals(modelTotals, usageSignal.modelTotals);
      mergeModelBreakdowns(modelBreakdowns, usageSignal.modelBreakdowns);
      hits += usageSignal.hits;
      return;
    }

    const currentModel = preferredModel(extractModel(record), inheritedModel);
    const model = canonicalizeModelId(currentModel);
    let recordCategorizedSum = 0;
    let recordTotalValue: number | undefined;
    for (const [key, rawValue] of Object.entries(record)) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey === 'retryinfos' || normalizedKey === 'contextwindowmetadata' || /limit|max|window|estimated|quota/.test(normalizedKey)) {
        continue;
      }

      const numericValue = toFiniteNumber(rawValue);
      if (numericValue !== undefined) {
        if (/^(input|prompt).*token/.test(normalizedKey)) {
          breakdown.inputTokens += numericValue;
          recordCategorizedSum += numericValue;
          mergeModelCategory(modelBreakdowns, model, { inputTokens: numericValue });
          hits += 1;
        } else if (/^(output|completion).*token/.test(normalizedKey)) {
          breakdown.outputTokens += numericValue;
          recordCategorizedSum += numericValue;
          mergeModelCategory(modelBreakdowns, model, { outputTokens: numericValue });
          hits += 1;
        } else if (/cache.*read.*token/.test(normalizedKey)) {
          breakdown.cacheReadTokens += numericValue;
          recordCategorizedSum += numericValue;
          mergeModelCategory(modelBreakdowns, model, { cacheReadTokens: numericValue });
          hits += 1;
        } else if (/cache.*write.*token/.test(normalizedKey)) {
          breakdown.cacheWriteTokens += numericValue;
          recordCategorizedSum += numericValue;
          mergeModelCategory(modelBreakdowns, model, { cacheWriteTokens: numericValue });
          hits += 1;
        } else if (/(reasoning|thinking).*token/.test(normalizedKey)) {
          breakdown.reasoningTokens += numericValue;
          recordCategorizedSum += numericValue;
          mergeModelCategory(modelBreakdowns, model, { reasoningTokens: numericValue });
          hits += 1;
        } else if (normalizedKey === 'totaltokens' || normalizedKey === 'total_tokens') {
          recordTotalValue = Math.max(recordTotalValue ?? 0, numericValue);
          hits += 1;
        }
      }

      visit(rawValue, currentModel);
    }

    if (recordTotalValue !== undefined && recordTotalValue > recordCategorizedSum) {
      breakdown.totalTokens += recordTotalValue - recordCategorizedSum;
      mergeModelCategory(modelBreakdowns, model, { totalTokens: recordTotalValue });
    }
    if (recordCategorizedSum > 0 || recordTotalValue !== undefined) {
      modelTotals[model] = (modelTotals[model] ?? 0) + Math.max(recordCategorizedSum, recordTotalValue ?? 0);
    }
  };

  visit(value);
  breakdown.totalTokens = normalizeTotal(breakdown);
  finalizeModelBreakdowns(modelBreakdowns);
  return { breakdown, hits, modelTotals, modelBreakdowns };
}

function countStepRows(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  const record = value as Record<string, unknown>;
  if (record.recordType === 'step') {
    return 1;
  }
  return record.type === 'USER_INPUT' || record.type === 'PLANNER_RESPONSE' ? 1 : 0;
}
function countMessages(parsed: unknown): number {
  if (!parsed || typeof parsed !== 'object') {
    return 0;
  }
  const record = parsed as Record<string, unknown>;
  if (record.records && Array.isArray(record.records)) {
    let count = 0;
    for (const item of record.records) {
      count += countStepRows(item);
    }
    return count;
  }
  return countStepRows(parsed);
}


export type ExtractedCanonicalUsage = {
  requestId?: string;
  nativeCascadeId?: string;
  timestamp?: number;
  stepIndices?: number[];
  model: string;
  breakdown: TokenBreakdown;
};

export function extractCanonicalUsageFields(
  record: Record<string, unknown>,
  inheritedModel?: string
): ExtractedCanonicalUsage | null {
  if (record.recordType !== 'usage') {
    return null;
  }

  const raw = record.raw;
  const rawRecord = raw && typeof raw === 'object' ? raw as Record<string, unknown> : undefined;
  const chatModel = rawRecord?.chatModel;
  const chatModelRecord = chatModel && typeof chatModel === 'object' ? chatModel as Record<string, unknown> : undefined;
  const usage = chatModelRecord?.usage;
  const usageRecord = usage && typeof usage === 'object' ? usage as Record<string, unknown> : undefined;
  const customMetadata = chatModelRecord?.customMetadata;
  const customMetadataRecord = customMetadata && typeof customMetadata === 'object'
    ? customMetadata as Record<string, unknown>
    : undefined;

  const model = preferredModel(
    extractModel(record),
    chatModelRecord?.responseModel,
    chatModelRecord?.modelDisplayName,
    chatModelRecord?.modelName,
    chatModelRecord?.model,
    usageRecord?.responseModel,
    usageRecord?.modelName,
    usageRecord?.model,
    inheritedModel
  ) ?? 'unknown';

  const requestId = firstString(
    usageRecord?.responseId,
    usageRecord?.messageId,
    record.responseId,
    record.messageId
  );
  const nativeCascadeId = firstString(customMetadataRecord?.cascade_id);
  const timestamp = parseOptionalTimestamp(record.timestamp) ?? parseOptionalTimestamp(rawRecord?.timestamp);
  const stepIndicesRaw = rawRecord?.stepIndices ?? record.stepIndices;
  const stepIndices = Array.isArray(stepIndicesRaw)
    ? stepIndicesRaw.filter((item): item is number => typeof item === 'number' && Number.isFinite(item))
    : undefined;

  // 权威数据源 raw.chatModel.usage 优先，防止读取旧版导出写错为 2 倍的顶层脏字段
  const inputTokens = toFiniteNumber(usageRecord?.inputTokens) ?? toFiniteNumber(record.inputTokens) ?? 0;
  const cacheReadTokens = toFiniteNumber(usageRecord?.cacheReadTokens) ?? toFiniteNumber(record.cacheReadTokens) ?? 0;
  const cacheWriteTokens = toFiniteNumber(usageRecord?.cacheWriteTokens) ?? toFiniteNumber(record.cacheWriteTokens) ?? 0;

  const rawTotalOutput = preferObservedNumber(
    toFiniteNumber(usageRecord?.outputTokens),
    toFiniteNumber(record.outputTokens)
  );
  const rawResponseOutput = toFiniteNumber(usageRecord?.responseOutputTokens);
  const usageThinking = toFiniteNumber(usageRecord?.thinkingOutputTokens) ?? toFiniteNumber(usageRecord?.reasoningTokens);
  const reasoningTokens = usageThinking ?? toFiniteNumber(record.reasoningTokens) ?? 0;

  // 在 Antigravity/Gemini RPC 中 usage.outputTokens 恒等于 responseOutputTokens + thinkingOutputTokens；
  // 为避免后续 subtotal 与计费把思考 Token 二次相加，拆分为正交的纯答复输出 + 深度思考
  let outputTokens: number;
  if (usageThinking !== undefined && rawTotalOutput >= usageThinking) {
    outputTokens = rawResponseOutput !== undefined ? rawResponseOutput : Math.max(0, rawTotalOutput - usageThinking);
  } else if (rawResponseOutput !== undefined && rawTotalOutput === 0) {
    outputTokens = rawResponseOutput;
  } else if (rawResponseOutput !== undefined && reasoningTokens > 0 && rawTotalOutput === rawResponseOutput + reasoningTokens) {
    outputTokens = rawResponseOutput;
  } else {
    outputTokens = rawTotalOutput;
  }

  const rawTotal = toFiniteNumber(usageRecord?.totalTokens)
    ?? (inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens === 0 ? toFiniteNumber(record.totalTokens) : undefined)
    ?? 0;

  const breakdown: TokenBreakdown = {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    totalTokens: rawTotal
  };
  breakdown.totalTokens = normalizeTotal(breakdown);

  return { requestId, nativeCascadeId, timestamp, stepIndices, model, breakdown };
}

function toCanonicalSignalResult(extracted: ExtractedCanonicalUsage): SignalResult {
  const { model, breakdown } = extracted;
  const categorizedTotal = breakdown.inputTokens + breakdown.outputTokens + breakdown.cacheReadTokens + breakdown.cacheWriteTokens + breakdown.reasoningTokens;
  const modelTotals = categorizedTotal > 0 ? { [model]: categorizedTotal } : {};
  const modelBreakdowns = categorizedTotal > 0 ? { [model]: breakdown } : {};
  const hits = categorizedTotal > 0 || breakdown.totalTokens > 0 ? 1 : 0;

  return { breakdown, hits, modelTotals, modelBreakdowns };
}

function extractCanonicalUsageSignal(record: Record<string, unknown>, inheritedModel?: string): SignalResult | null {
  const extracted = extractCanonicalUsageFields(record, inheritedModel);
  return extracted ? toCanonicalSignalResult(extracted) : null;
}

function finalizeReported(
  candidate: SessionParsePlan,
  label: string,
  breakdown: TokenBreakdown,
  modelTotals: Record<string, number>,
  modelBreakdowns: Record<string, ModelTokenBreakdown>,
  evidenceCount: number,
  messageCount: number,
  dailyBreakdowns?: Record<string, DailyTokenBreakdown>
): SessionTotals {
  return {
    sessionId: candidate.sessionId,
    label,
    filePath: candidate.sessionDir,
    lastModifiedMs: candidate.lastModifiedMs,
    mode: 'reported',
    source: candidate.source,
    evidenceCount,
    modelTotals,
    modelBreakdowns,
    ...(dailyBreakdowns && Object.keys(dailyBreakdowns).length > 0 ? { dailyBreakdowns } : {}),
    messageCount,
    ...breakdown,
    totalTokens: normalizeTotal(breakdown)
  };
}

function collectStepTimestamp(value: unknown, stepTimestampByIndex: Map<number, number>): void {
  if (!value || typeof value !== 'object') {
    return;
  }
  const record = value as Record<string, unknown>;
  const stepIdx = typeof record.stepIndex === 'number'
    ? record.stepIndex
    : typeof record.step_index === 'number'
      ? record.step_index
      : undefined;
  if (stepIdx === undefined) {
    return;
  }
  const ts = parseOptionalTimestamp(record.timestamp) ?? parseOptionalTimestamp(record.created_at);
  if (ts !== undefined) {
    stepTimestampByIndex.set(stepIdx, ts);
  }
}

function parseOptionalTimestamp(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 1_000_000_000) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 1_000_000_000) {
      return parsed;
    }
  }
  return undefined;
}

export function formatLocalDateKey(timestampMs: number): string {
  const date = new Date(timestampMs);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDailyBreakdownsFromEntries(
  entries: CanonicalUsageEntry[],
  stepTimestampByIndex: Map<number, number>,
  fallbackModifiedMs: number
): Record<string, DailyTokenBreakdown> | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  const daily: Record<string, DailyTokenBreakdown> = {};
  for (const entry of entries) {
    let ts = entry.timestamp;
    if (ts === undefined && entry.stepIndices) {
      for (const sIdx of entry.stepIndices) {
        const mapped = stepTimestampByIndex.get(sIdx);
        if (mapped !== undefined) {
          ts = mapped;
          break;
        }
      }
    }
    const effectiveTs = ts ?? fallbackModifiedMs;
    const dateKey = formatLocalDateKey(effectiveTs);
    const bucket = daily[dateKey] ?? { ...emptyBreakdown(), messageCount: 0 };
    mergeBreakdown(bucket, entry.breakdown);
    bucket.totalTokens = normalizeTotal(bucket);
    bucket.messageCount += 1;
    daily[dateKey] = bucket;
  }

  return Object.keys(daily).length > 0 ? daily : undefined;
}

function finalizeEstimated(candidate: SessionParsePlan, label: string, text: string, messageCount: number): SessionTotals {
  const estimatedTotal = estimateTokens(text);
  return {
    sessionId: candidate.sessionId,
    label,
    filePath: candidate.sessionDir,
    lastModifiedMs: candidate.lastModifiedMs,
    mode: 'estimated',
    source: candidate.source,
    evidenceCount: 0,
    modelTotals: {},
    modelBreakdowns: {},
    messageCount,
    inputTokens: Math.round(estimatedTotal * 0.62),
    outputTokens: Math.round(estimatedTotal * 0.38),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: estimatedTotal
  };
}

function estimateTokens(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  return Math.max(1, Math.round(normalized.length / 4));
}

function emptyBreakdown(): TokenBreakdown {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0
  };
}

function mergeBreakdown(target: TokenBreakdown, source: TokenBreakdown): void {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.reasoningTokens += source.reasoningTokens;
  target.totalTokens += source.totalTokens;
}

export function normalizeTotal(breakdown: TokenBreakdown): number {
  const subtotal = breakdown.inputTokens
    + breakdown.outputTokens
    + breakdown.cacheReadTokens
    + breakdown.cacheWriteTokens
    + breakdown.reasoningTokens;

  return Math.max(breakdown.totalTokens, subtotal);
}

function mergeModelTotals(target: Record<string, number>, source: Record<string, number>): void {
  for (const [model, total] of Object.entries(source)) {
    if (total === 0) {
      continue;
    }
    target[model] = (target[model] ?? 0) + total;
  }
}

function mergeModelBreakdowns(
  target: Record<string, ModelTokenBreakdown>,
  source: Record<string, ModelTokenBreakdown>
): void {
  for (const [model, breakdown] of Object.entries(source)) {
    const next = target[model] ?? emptyBreakdown();
    mergeBreakdown(next, breakdown);
    next.totalTokens = normalizeTotal(next);
    target[model] = next;
  }
}

function mergeModelCategory(
  target: Record<string, ModelTokenBreakdown>,
  model: string,
  partial: Partial<ModelTokenBreakdown>
): void {
  const next = target[model] ?? emptyBreakdown();
  next.inputTokens += partial.inputTokens ?? 0;
  next.outputTokens += partial.outputTokens ?? 0;
  next.cacheReadTokens += partial.cacheReadTokens ?? 0;
  next.cacheWriteTokens += partial.cacheWriteTokens ?? 0;
  next.reasoningTokens += partial.reasoningTokens ?? 0;
  next.totalTokens += partial.totalTokens ?? 0;
  target[model] = next;
}

function finalizeModelBreakdowns(target: Record<string, ModelTokenBreakdown>): void {
  for (const breakdown of Object.values(target)) {
    breakdown.totalTokens = normalizeTotal(breakdown);
  }
}

function extractModel(input: Record<string, unknown>): string | undefined {
  const direct = preferredModel(input.responseModel, input.model, input.modelId, input.modelName);
  if (direct) {
    return direct;
  }

  const chatModel = input.chatModel;
  if (chatModel && typeof chatModel === 'object') {
    const chatModelRecord = chatModel as Record<string, unknown>;
    const nested = preferredModel(
      chatModelRecord.responseModel,
      chatModelRecord.modelDisplayName,
      chatModelRecord.model,
      chatModelRecord.modelId,
      chatModelRecord.modelName
    );
    if (nested) {
      return nested;
    }

    const usage = chatModelRecord.usage;
    if (usage && typeof usage === 'object') {
      const usageRecord = usage as Record<string, unknown>;
      return preferredModel(
        usageRecord.responseModel,
        usageRecord.model,
        usageRecord.modelId,
        usageRecord.modelName
      );
    }
  }

  return undefined;
}

function preferredModel(...values: unknown[]): string | undefined {
  const candidates = values
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());

  for (const candidate of candidates) {
    if (!isPlaceholderModel(candidate)) {
      return candidate;
    }
  }

  const fallback = candidates[0];
  return fallback ? (resolveModelPlaceholder(fallback) ?? fallback) : undefined;
}

function isPlaceholderModel(value: string): boolean {
  return value.startsWith('MODEL_PLACEHOLDER_');
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

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function preferObservedNumber(...values: Array<number | undefined>): number {
  for (const value of values) {
    if (value !== undefined && value > 0) {
      return value;
    }
  }

  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }

  return 0;
}
