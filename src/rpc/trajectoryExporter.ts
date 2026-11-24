import type { MonitorConfig } from '../core/config';
import { resolveModelPlaceholder } from '../modelAliases';
import { SessionScanCandidate, RpcArtifactManifest } from '../types';
import { RpcArtifactStore } from '../storage/rpcArtifactStore';
import { AntigravityRpcClient } from './antigravityRpcClient';
import { readSqliteTrajectoryPayload } from './sqliteTrajectoryReader';

type TrajectorySummary = {
  sessionId: string;
  lastModifiedMs?: number;
  stepCount?: number;
};

const MAX_RPC_ATTEMPTS = 2;

export class TrajectoryExporter {
  private readonly client: AntigravityRpcClient;

  constructor(
    private readonly config: MonitorConfig,
    private readonly artifactStore: RpcArtifactStore,
    private readonly log?: (message: string) => void
  ) {
    this.client = new AntigravityRpcClient(config, log);
  }

  async exportChangedSessions(
    candidates: SessionScanCandidate[],
    options?: { force?: boolean; selectiveForce?: boolean }
  ): Promise<{ manifests: Map<string, RpcArtifactManifest>; exportedCount: number }> {
    const manifests = new Map<string, RpcArtifactManifest>();
    if (!this.config.useRpcExport) {
      return { manifests, exportedCount: 0 };
    }

    let exportedCount = 0;

    try {
      let summaries: TrajectorySummary[] = [];
      let summaryError: unknown;
      try {
        summaries = await this.fetchSummariesWithRetry();
        this.log?.(`RPC summaries fetched: ${summaries.length}. Scanner candidates: ${candidates.length}.`);
      } catch (rpcSummaryError) {
        summaryError = rpcSummaryError;
        const message = toErrorMessage(rpcSummaryError);
        this.log?.(`TrajectoryExporter: RPC export unavailable after retry: ${message}`);
        console.warn('[antigravity-token-monitor] RPC export unavailable:', rpcSummaryError);
      }
      const summaryById = new Map(summaries.map((summary) => [summary.sessionId, summary]));
      let unmatchedCount = 0;

      for (const candidate of candidates) {
        let summary = summaryById.get(candidate.sessionId);
        if (!summary) {
          unmatchedCount += 1;
          // 목록에서 누락된 경우, 파일 시스템의 메타데이터를 기반으로 강제 조회 시도 (Fallback)
          summary = {
            sessionId: candidate.sessionId,
            lastModifiedMs: candidate.lastModifiedMs,
            stepCount: undefined
          };
        }

        const previous = await this.artifactStore.loadManifest(candidate.sessionId);
        const hasUsage = await this.artifactStore.hasNonEmptyUsage(candidate.sessionId);
        const force = options?.force === true;
        const selectiveForce = options?.selectiveForce === true;
        const shouldForceThisSession = force || !hasUsage || (
          selectiveForce && (
            summaryById.has(candidate.sessionId)
            || !previous?.artifactHash
            || (previous?.failureCount ?? 0) > 0
          )
        );
        const exportNeeded = shouldExport(summary, previous, shouldForceThisSession, candidate.lastModifiedMs);
        this.log?.(
          `TrajectoryExporter: session=${candidate.sessionId} exportNeeded=${exportNeeded} hasUsage=${hasUsage} force=${force} selectiveForce=${selectiveForce} forcedSession=${shouldForceThisSession} previousModified=${previous?.serverLastModifiedMs ?? 'none'} nextModified=${summary.lastModifiedMs ?? 'none'} candidateModified=${candidate.lastModifiedMs} previousStepCount=${previous?.stepCount ?? 'none'} nextStepCount=${summary.stepCount ?? 'none'}.`
        );
        if (!exportNeeded) {
          if (previous) {
            manifests.set(candidate.sessionId, previous);
          }
          continue;
        }

        try {
          let payload: { steps: unknown[]; metadata: unknown[] } = { steps: [], metadata: [] };
          let rpcError: unknown;
          if (!summaryError) {
            try {
              payload = await this.fetchSessionPayloadWithRetry(candidate.sessionId);
            } catch (error) {
              rpcError = error;
              payload = { steps: [], metadata: [] };
            }
          }

          let sqliteLastModifiedMs: number | undefined;
          const sqlitePayload = readSqliteTrajectoryPayload(this.config.sessionRoot, candidate.sessionId);
          if (sqlitePayload) {
            sqliteLastModifiedMs = sqlitePayload.lastModifiedMs;
            if (payload.metadata.length === 0 && sqlitePayload.metadata.length > 0) {
              payload.metadata = sqlitePayload.metadata;
            } else if (sqlitePayload.metadata.length > payload.metadata.length) {
              payload.metadata = sqlitePayload.metadata;
            }
            if (payload.steps.length === 0 && sqlitePayload.steps.length > 0) {
              payload.steps = sqlitePayload.steps;
            } else if (sqlitePayload.steps.length > payload.steps.length) {
              payload.steps = sqlitePayload.steps;
            }
          }

          if (rpcError && payload.metadata.length === 0 && payload.steps.length === 0) {
            throw rpcError;
          }

          if (payload.steps.length === 0 && payload.metadata.length === 0) {
            this.log?.(`TrajectoryExporter: session=${candidate.sessionId} returned empty steps and metadata; skipping cache write.`);
            if (previous && hasUsage) {
              manifests.set(candidate.sessionId, previous);
            }
            continue;
          }

          this.log?.(
            `TrajectoryExporter: session=${candidate.sessionId} fetched steps=${payload.steps.length} metadata=${payload.metadata.length}.`
          );
          const resolvedModifiedMs = Math.max(
            summary.lastModifiedMs ?? 0,
            sqliteLastModifiedMs ?? 0,
            candidate.lastModifiedMs
          );
          const next = await this.artifactStore.writeSessionArtifacts({
            sessionId: candidate.sessionId,
            serverLastModifiedMs: resolvedModifiedMs > 0 ? resolvedModifiedMs : summary.lastModifiedMs,
            stepCount: summary.stepCount ?? (payload.steps.length > 0 ? payload.steps.length : undefined),
            steps: this.config.exportStepsJsonl
              ? serializeSteps(candidate.sessionId, payload.steps)
              : serializeStepsRedacted(candidate.sessionId, payload.steps, payload.metadata.length === 0),
            usage: serializeUsage(candidate.sessionId, payload.metadata, payload.steps)
          });
          manifests.set(candidate.sessionId, next);
          exportedCount += 1;
        } catch (error) {
          await this.artifactStore.recordFailure(candidate.sessionId, error);
          const message = toErrorMessage(error);
          this.log?.(`TrajectoryExporter: session=${candidate.sessionId} export failure recorded: ${message}`);
          console.warn(`[antigravity-token-monitor] Failed to export RPC artifacts for ${candidate.sessionId}:`, error);
        }
      }

      if (unmatchedCount > 0) {
        this.log?.(
          `RPC export fallback: Forced direct export for ${unmatchedCount} candidate(s) not found in RPC summaries.`
        );
      }

      this.log?.(`RPC export processed ${candidates.length} scanner candidates; wrote ${exportedCount} artifact set(s).`);

      return { manifests, exportedCount };
    } catch (error) {
      const message = toErrorMessage(error);
      this.log?.(`TrajectoryExporter: RPC export unavailable after retry: ${message}`);
      console.warn('[antigravity-token-monitor] RPC export unavailable:', error);
      return { manifests, exportedCount };
    }
  }

  private async fetchSummariesWithRetry(): Promise<TrajectorySummary[]> {
    for (let attempt = 1; attempt <= MAX_RPC_ATTEMPTS; attempt += 1) {
      await this.client.flush().catch((error) => {
        const message = toErrorMessage(error);
        this.log?.(`TrajectoryExporter: RPC flush warning on attempt ${attempt}/${MAX_RPC_ATTEMPTS}: ${message}`);
        console.warn('[antigravity-token-monitor] RPC flush warn (non-fatal):', error);
      });

      try {
        return await this.client.listTrajectories();
      } catch (error) {
        const message = toErrorMessage(error);
        const retryAfterMs = extractRetryAfterMs(error);
        if (retryAfterMs > 0) {
          this.log?.(`TrajectoryExporter: Rate limited, waiting ${retryAfterMs}ms before retry.`);
          await sleep(retryAfterMs);
          continue;
        }
        this.log?.(`TrajectoryExporter: RPC summary fetch failed on attempt ${attempt}/${MAX_RPC_ATTEMPTS}: ${message}`);
        if (attempt >= MAX_RPC_ATTEMPTS) {
          throw error;
        }
        this.log?.('TrajectoryExporter: resetting RPC connection cache and retrying summary fetch immediately.');
        this.client.resetConnection();
      }
    }

    return [];
  }


  private async fetchSessionPayloadWithRetry(sessionId: string): Promise<{ steps: unknown[]; metadata: unknown[] }> {
    for (let attempt = 1; attempt <= MAX_RPC_ATTEMPTS; attempt += 1) {
      try {
        const steps = await this.client.getTrajectorySteps(sessionId);
        const metadata = await this.client.getTrajectoryMetadata(sessionId);
        return { steps, metadata };
      } catch (error) {
        const message = toErrorMessage(error);
        this.log?.(
          `TrajectoryExporter: session=${sessionId} RPC payload fetch failed on attempt ${attempt}/${MAX_RPC_ATTEMPTS}: ${message}`
        );
        if (attempt >= MAX_RPC_ATTEMPTS) {
          throw error;
        }
        this.log?.(`TrajectoryExporter: session=${sessionId} resetting RPC connection cache and retrying immediately.`);
        this.client.resetConnection();
      }
    }

    return { steps: [], metadata: [] };
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldExport(
  summary: TrajectorySummary,
  previous: RpcArtifactManifest | null,
  force: boolean,
  candidateLastModifiedMs?: number
): boolean {
  if (force) {
    return true;
  }

  if (!previous?.artifactHash) {
    return true;
  }

  if (
    candidateLastModifiedMs !== undefined
    && previous.serverLastModifiedMs !== undefined
    && candidateLastModifiedMs > previous.serverLastModifiedMs + 1000
  ) {
    return true;
  }

  if (summary.lastModifiedMs !== undefined && previous.serverLastModifiedMs !== summary.lastModifiedMs) {
    return true;
  }

  if (summary.stepCount !== undefined && previous.stepCount !== summary.stepCount) {
    return true;
  }

  return false;
}

function serializeSteps(sessionId: string, steps: unknown[]): unknown[] {
  return steps.map((step, index) => {
    const record = step && typeof step === 'object' ? step as Record<string, unknown> : {};
    return {
      recordType: 'step',
      sessionId,
      stepIndex: index,
      role: extractRole(record),
      timestamp: extractTimestamp(record),
      model: extractModel(record),
      text: extractStepText(record)
    };
  });
}

/**
 * Serializes steps with metadata and usage data — omits conversation text (`text` field)
 * to prevent plaintext content from being written to disk when exportStepsJsonl is off.
 *
 * Includes extracted token usage so the parser can derive accurate `reported` mode totals
 * even when the metadata RPC (`GetCascadeTrajectoryGeneratorMetadata`) returns empty.
 */
function serializeStepsRedacted(sessionId: string, steps: unknown[], includeFallbackUsage = true): unknown[] {
  return steps.map((step, index) => {
    const record = step && typeof step === 'object' ? step as Record<string, unknown> : {};
    const usage = includeFallbackUsage ? extractUsage(record) : undefined;
    return {
      recordType: 'step',
      sessionId,
      stepIndex: index,
      role: extractRole(record),
      timestamp: extractTimestamp(record),
      model: extractModel(record),
      ...(usage && usage.totalTokens > 0 ? usage : {})
    };
  });
}

function serializeUsage(sessionId: string, metadata: unknown[], steps: unknown[] = []): unknown[] {
  const stepTimestampByIndex = new Map<number, number>();
  steps.forEach((step, index) => {
    const ts = extractTimestamp(step);
    if (ts !== undefined) {
      const record = step && typeof step === 'object' ? step as Record<string, unknown> : undefined;
      const explicitIdx = typeof record?.stepIndex === 'number' ? record.stepIndex : index;
      stepTimestampByIndex.set(explicitIdx, ts);
    }
  });

  return metadata.map((entry, index) => {
    const usage = extractUsage(entry);
    let timestamp = extractTimestamp(entry);
    if (timestamp === undefined && entry && typeof entry === 'object') {
      const stepIndices = (entry as { stepIndices?: unknown }).stepIndices;
      if (Array.isArray(stepIndices)) {
        for (const sIdx of stepIndices) {
          if (typeof sIdx === 'number') {
            const ts = stepTimestampByIndex.get(sIdx);
            if (ts !== undefined) {
              timestamp = ts;
              break;
            }
          }
        }
      }
    }

    return {
      recordType: 'usage',
      sessionId,
      sequence: index,
      timestamp,
      model: extractUsageModel(entry),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
      reasoningTokens: usage.reasoningTokens,
      totalTokens: usage.totalTokens,
      raw: entry
    };
  });
}

function extractStepText(input: Record<string, unknown>): string {
  const userInput = input.userInput;
  if (userInput && typeof userInput === 'object') {
    const record = userInput as Record<string, unknown>;
    if (typeof record.userResponse === 'string' && record.userResponse.trim()) {
      return record.userResponse;
    }

    if (Array.isArray(record.items)) {
      const parts = record.items
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }
          const entry = item as Record<string, unknown>;
          const textValue = entry.text;
          if (textValue && typeof textValue === 'object') {
            const content = (textValue as Record<string, unknown>).content;
            if (typeof content === 'string') {
              return content;
            }
          }
          const codeValue = entry.code;
          if (codeValue && typeof codeValue === 'object') {
            const value = (codeValue as Record<string, unknown>).value;
            if (typeof value === 'string') {
              return value;
            }
          }
          return '';
        })
        .filter((value) => value.length > 0);
      if (parts.length > 0) {
        return parts.join('\n\n');
      }
    }
  }

  const modelResponse = input.modelResponse;
  if (modelResponse && typeof modelResponse === 'object') {
    const record = modelResponse as Record<string, unknown>;
    if (Array.isArray(record.content)) {
      const text = record.content
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return '';
          }
          const part = item as Record<string, unknown>;
          const textValue = part.text;
          if (textValue && typeof textValue === 'object') {
            const content = (textValue as Record<string, unknown>).content;
            return typeof content === 'string' ? content : '';
          }
          return '';
        })
        .filter((value) => value.length > 0)
        .join('\n');
      if (text) {
        return text;
      }
    }

    if (typeof record.text === 'string') {
      return record.text;
    }
  }

  const plannerResponse = input.plannerResponse;
  if (plannerResponse && typeof plannerResponse === 'object') {
    const thinking = (plannerResponse as Record<string, unknown>).thinking;
    if (typeof thinking === 'string') {
      return thinking;
    }
  }

  return firstString(input.text, messageText(input.message)) ?? '';
}

function extractRole(input: Record<string, unknown>): string {
  if (input.type === 'CORTEX_STEP_TYPE_USER_INPUT') {
    return 'user';
  }
  if (input.type === 'CORTEX_STEP_TYPE_MODEL_RESPONSE' || input.type === 'CORTEX_STEP_TYPE_PLANNER_RESPONSE') {
    return 'model';
  }

  const header = input.header;
  if (header && typeof header === 'object') {
    const sender = (header as Record<string, unknown>).sender;
    return sender === 'USER' ? 'user' : 'model';
  }

  return 'unknown';
}

function extractModel(input: Record<string, unknown>): string | undefined {
  return firstString(input.model, input.modelId, input.modelName);
}

function extractTimestamp(input: unknown): number | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const record = input as Record<string, unknown>;
  const metadata = record.metadata && typeof record.metadata === 'object'
    ? record.metadata as Record<string, unknown>
    : undefined;
  for (const value of [
    record.timestamp,
    record.createdAt,
    record.lastModifiedTime,
    metadata?.createdAt,
    metadata?.timestamp
  ]) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function extractUsage(input: unknown) {
  const result = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0
  };

  if (!input || typeof input !== 'object') {
    return result;
  }

  const record = input as Record<string, unknown>;

  // 1. 优先提取规范的 chatModel.usage（精准单次响应，避免被 retryInfos 镜像对象重复翻倍）
  const chatModel = record.chatModel as Record<string, unknown> | undefined;
  const canonicalUsage = (chatModel?.usage || record.usage) as Record<string, unknown> | undefined;

  if (canonicalUsage && typeof canonicalUsage === 'object') {
    const inp = toFiniteNumber(canonicalUsage.inputTokens) ?? toFiniteNumber(canonicalUsage.promptTokens) ?? 0;
    const rawOut = toFiniteNumber(canonicalUsage.outputTokens) ?? toFiniteNumber(canonicalUsage.completionTokens) ?? 0;
    const respOut = toFiniteNumber(canonicalUsage.responseOutputTokens);
    const rsn = toFiniteNumber(canonicalUsage.thinkingOutputTokens) ?? toFiniteNumber(canonicalUsage.reasoningTokens) ?? 0;
    const cch = toFiniteNumber(canonicalUsage.cacheReadTokens) ?? 0;
    const cchw = toFiniteNumber(canonicalUsage.cacheWriteTokens) ?? 0;
    const out = rsn > 0 && rawOut >= rsn
      ? (respOut !== undefined ? respOut : Math.max(0, rawOut - rsn))
      : (respOut !== undefined && rawOut === 0 ? respOut : rawOut);

    result.inputTokens = inp;
    result.outputTokens = out;
    result.reasoningTokens = rsn;
    result.cacheReadTokens = cch;
    result.cacheWriteTokens = cchw;
    result.totalTokens = inp + out + rsn + cch + cchw;
    return result;
  }

  // 2. 回退机制：若无规范 usage 对象，进行浅层扫描（严格排除 retryInfos 等重复镜像对象）
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 2 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(item => visit(item, depth + 1));
      return;
    }

    const obj = value as Record<string, unknown>;
    for (const [key, rawValue] of Object.entries(obj)) {
      if (key === 'retryInfos' || key === 'stepIndices' || key === 'mendelExperimentIds') continue;

      const normalizedKey = key.toLowerCase();
      const numericValue = toFiniteNumber(rawValue);
      if (numericValue !== undefined) {
        if (/^(input|prompt).*token/.test(normalizedKey) && result.inputTokens === 0) {
          result.inputTokens = numericValue;
        } else if (/^(output|completion).*token/.test(normalizedKey) && result.outputTokens === 0) {
          result.outputTokens = numericValue;
        } else if (/cache.*read.*token/.test(normalizedKey) && result.cacheReadTokens === 0) {
          result.cacheReadTokens = numericValue;
        } else if (/cache.*write.*token/.test(normalizedKey) && result.cacheWriteTokens === 0) {
          result.cacheWriteTokens = numericValue;
        } else if (/(reasoning|thinking).*token/.test(normalizedKey) && result.reasoningTokens === 0) {
          result.reasoningTokens = numericValue;
        }
      } else {
        visit(rawValue, depth + 1);
      }
    }
  };

  visit(input);
  result.totalTokens = result.inputTokens + result.outputTokens + result.cacheReadTokens + result.cacheWriteTokens;
  return result;
}

function extractUsageModel(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const direct = preferredModel(record.responseModel, record.model, record.modelName, record.modelId);
  if (direct) {
    return direct;
  }

  const chatModel = record.chatModel;
  if (chatModel && typeof chatModel === 'object') {
    const chatModelRecord = chatModel as Record<string, unknown>;
    const fromChatModel = preferredModel(
      chatModelRecord.responseModel,
      chatModelRecord.modelDisplayName,
      chatModelRecord.model,
      chatModelRecord.modelName,
      chatModelRecord.modelId
    );
    if (fromChatModel) {
      return fromChatModel;
    }

    const usage = chatModelRecord.usage;
    if (usage && typeof usage === 'object') {
      const usageRecord = usage as Record<string, unknown>;
      const fromUsage = preferredModel(
        usageRecord.responseModel,
        usageRecord.model,
        usageRecord.modelName,
        usageRecord.modelId
      );
      if (fromUsage) {
        return fromUsage;
      }
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

function messageText(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }
  const text = (input as Record<string, unknown>).text;
  return typeof text === 'string' ? text : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return undefined;
}


/**
 * Extracts Retry-After milliseconds from an error message if it contains a 429 status code.
 */
function extractRetryAfterMs(error: unknown): number {
  if (error instanceof Error) {
    // Match patterns like '429' or 'rate limit' in error messages
    if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
      // Try to extract Retry-After header value from the message
      const match = error.message.match(/retry[- ]?after[=:]?\s*(\d+)/i);
      if (match) {
        return parseInt(match[1], 10) * 1000;
      }
      // Default to exponential backoff if no explicit value
      return 5000;
    }
  }
  return 0;
}

/**
 * Sleep utility for async retry delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}