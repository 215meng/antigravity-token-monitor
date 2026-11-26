import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { canonicalizeModelId } from '../modelAliases';
import {
  extractCanonicalUsageFields,
  formatLocalDateKey,
  normalizeTotal
} from '../parser/antigravitySessionParser';
import {
  clearDedupIndex,
  collectSessionSignatures,
  loadDedupIndex,
  saveDedupIndex,
  type DedupedSessionSnapshot,
  type DedupIndexFile,
  type DedupRequestClaim,
  type DedupSessionIndexEntry
} from './dedupIndex';
import {
  DailyTokenBreakdown,
  ModelTokenBreakdown,
  PersistedSessionState,
  TokenBreakdown
} from '../types';

export type IncrementalDedupResult = {
  sessions: Record<string, PersistedSessionState>;
  dirtyCount: number;
  recomputedCount: number;
  totalSessions: number;
  usedIndex: boolean;
};

type ParsedRequestRecord = {
  requestId?: string;
  nativeCascadeId?: string;
  timestamp?: number;
  stepIndices?: number[];
  model: string;
  breakdown: TokenBreakdown;
};

type TranscriptCallRecord = {
  stepIndex: number;
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  matched: boolean;
};

type RequestOwner = {
  sessionId: string;
  isNative: boolean;
  lastModifiedMs: number;
};

/**
 * Deduplicates LLM API request usage across forked/subagent sessions using unique
 * `responseId` / `messageId` keys so shared parent history is counted once,
 * fuses reverted branch calls from `transcript.jsonl` without double-counting,
 * and attributes every model call to its exact calendar day (`dailyBreakdowns`).
 */
export async function deduplicateSessionsFromArtifacts(
  sessions: Record<string, PersistedSessionState>,
  sessionRoot: string
): Promise<Record<string, PersistedSessionState>> {
  const sessionEntries = Object.entries(sessions);
  if (sessionEntries.length === 0) {
    return sessions;
  }

  const parsedBySession = new Map<string, ParsedRequestRecord[]>();
  const ownerByRequestId = new Map<string, RequestOwner>();

  for (const [sessionId, persisted] of sessionEntries) {
    const usagePath = path.join(sessionRoot, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'usage.jsonl');
    const records = await readSessionUsageRecords(usagePath);
    if (!records) {
      continue;
    }

    parsedBySession.set(sessionId, records);
    const sessionMtime = persisted.latest.lastModifiedMs || 0;

    for (const record of records) {
      if (!record.requestId) {
        continue;
      }

      const isNative = Boolean(record.nativeCascadeId && record.nativeCascadeId === sessionId);
      const currentOwner = ownerByRequestId.get(record.requestId);
      if (!currentOwner || shouldTransferOwnership(currentOwner, sessionId, isNative, sessionMtime)) {
        ownerByRequestId.set(record.requestId, {
          sessionId,
          isNative,
          lastModifiedMs: sessionMtime
        });
      }
    }
  }

  const nextSessions: Record<string, PersistedSessionState> = { ...sessions };

  for (const [sessionId, persisted] of sessionEntries) {
    const records = parsedBySession.get(sessionId);
    const snapshot = await computeSessionSnapshotFromDisk(
      sessionId,
      persisted,
      sessionRoot,
      records,
      ownerByRequestId
    );
    if (!snapshot) {
      continue;
    }

    nextSessions[sessionId] = applyDedupedSnapshot(persisted, snapshot);
  }

  return nextSessions;
}

/**
 * Incremental cross-session deduplication backed by `.token-monitor/dedup-index.v1.json`.
 * Only re-reads and recomputes dirty sessions plus any sibling sessions whose requestId
 * ownership changed; produces outputs strictly equivalent to `deduplicateSessionsFromArtifacts`.
 */
export async function deduplicateSessionsIncremental(
  sessions: Record<string, PersistedSessionState>,
  sessionRoot: string
): Promise<IncrementalDedupResult> {
  const sessionEntries = Object.entries(sessions);
  if (sessionEntries.length === 0) {
    await clearDedupIndex(sessionRoot);
    return {
      sessions,
      dirtyCount: 0,
      recomputedCount: 0,
      totalSessions: 0,
      usedIndex: false
    };
  }

  const [existingIndex, currentSignatures] = await Promise.all([
    loadDedupIndex(sessionRoot),
    collectSessionSignatures(sessionRoot, sessions)
  ]);

  const changedSessionIds = new Set<string>();
  for (const [sessionId] of sessionEntries) {
    const sigInfo = currentSignatures.get(sessionId);
    const entry = existingIndex?.sessions[sessionId];
    if (
      !entry
      || !sigInfo
      || entry.signature !== sigInfo.signature
      || entry.hasUsageFile !== sigInfo.hasUsageFile
      || entry.snapshot === undefined
      || !Array.isArray(entry.requestClaims)
    ) {
      changedSessionIds.add(sessionId);
    }
  }

  const removedSessionIds = new Set<string>();
  if (existingIndex) {
    for (const prevSessionId of Object.keys(existingIndex.sessions)) {
      if (!Object.prototype.hasOwnProperty.call(sessions, prevSessionId)) {
        removedSessionIds.add(prevSessionId);
      }
    }
  }

  // Zero-change fast path: 0 usage/transcript/sqlite reads
  if (existingIndex && changedSessionIds.size === 0 && removedSessionIds.size === 0) {
    const nextSessions: Record<string, PersistedSessionState> = { ...sessions };
    for (const [sessionId, persisted] of sessionEntries) {
      const snapshot = existingIndex.sessions[sessionId]?.snapshot;
      if (snapshot) {
        nextSessions[sessionId] = applyDedupedSnapshot(persisted, snapshot);
      }
    }
    return {
      sessions: nextSessions,
      dirtyCount: 0,
      recomputedCount: 0,
      totalSessions: sessionEntries.length,
      usedIndex: true
    };
  }

  const parsedBySession = new Map<string, ParsedRequestRecord[]>();
  const claimsBySession = new Map<string, DedupRequestClaim[]>();

  for (const [sessionId] of sessionEntries) {
    const sigInfo = currentSignatures.get(sessionId);
    if (!changedSessionIds.has(sessionId)) {
      const cachedClaims = existingIndex?.sessions[sessionId]?.requestClaims ?? [];
      claimsBySession.set(sessionId, cachedClaims);
      continue;
    }

    if (sigInfo?.hasUsageFile) {
      const usagePath = path.join(sessionRoot, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'usage.jsonl');
      const records = await readSessionUsageRecords(usagePath);
      if (records) {
        parsedBySession.set(sessionId, records);
        claimsBySession.set(sessionId, extractRequestClaims(sessionId, records));
        continue;
      }
    }
    claimsBySession.set(sessionId, []);
  }

  const previousOwnerByRequestId = new Map<string, RequestOwner>();
  if (existingIndex) {
    for (const [prevSessionId, entry] of Object.entries(existingIndex.sessions)) {
      if (!Array.isArray(entry.requestClaims)) {
        continue;
      }
      registerClaimsOwnership(previousOwnerByRequestId, prevSessionId, entry.lastModifiedMs || 0, entry.requestClaims);
    }
  }

  const ownerByRequestId = new Map<string, RequestOwner>();
  for (const [sessionId, persisted] of sessionEntries) {
    const claims = claimsBySession.get(sessionId) ?? [];
    registerClaimsOwnership(ownerByRequestId, sessionId, persisted.latest.lastModifiedMs || 0, claims);
  }

  const recomputeSessionIds = new Set<string>(changedSessionIds);
  if (existingIndex) {
    for (const [requestId, prevOwner] of previousOwnerByRequestId.entries()) {
      const nextOwner = ownerByRequestId.get(requestId);
      if (prevOwner.sessionId !== nextOwner?.sessionId) {
        if (Object.prototype.hasOwnProperty.call(sessions, prevOwner.sessionId)) {
          recomputeSessionIds.add(prevOwner.sessionId);
        }
        if (nextOwner && Object.prototype.hasOwnProperty.call(sessions, nextOwner.sessionId)) {
          recomputeSessionIds.add(nextOwner.sessionId);
        }
      }
    }
    for (const [requestId, nextOwner] of ownerByRequestId.entries()) {
      if (!previousOwnerByRequestId.has(requestId) && Object.prototype.hasOwnProperty.call(sessions, nextOwner.sessionId)) {
        recomputeSessionIds.add(nextOwner.sessionId);
      }
    }
  }

  // Ensure affected sibling sessions that were not originally dirty also load their usage.jsonl
  for (const sessionId of recomputeSessionIds) {
    if (!changedSessionIds.has(sessionId) && !parsedBySession.has(sessionId)) {
      const sigInfo = currentSignatures.get(sessionId);
      if (sigInfo?.hasUsageFile) {
        const usagePath = path.join(sessionRoot, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'usage.jsonl');
        const records = await readSessionUsageRecords(usagePath);
        if (records) {
          parsedBySession.set(sessionId, records);
        }
      }
    }
  }

  const nextSessions: Record<string, PersistedSessionState> = { ...sessions };
  const nextIndexSessions: Record<string, DedupSessionIndexEntry> = {};

  for (const [sessionId, persisted] of sessionEntries) {
    const sigInfo = currentSignatures.get(sessionId)!;
    const claims = claimsBySession.get(sessionId) ?? [];

    if (!recomputeSessionIds.has(sessionId) && existingIndex?.sessions[sessionId]) {
      const cachedEntry = existingIndex.sessions[sessionId];
      nextIndexSessions[sessionId] = cachedEntry;
      if (cachedEntry.snapshot) {
        nextSessions[sessionId] = applyDedupedSnapshot(persisted, cachedEntry.snapshot);
      }
      continue;
    }

    const records = parsedBySession.get(sessionId);
    const snapshot = await computeSessionSnapshotFromDisk(
      sessionId,
      persisted,
      sessionRoot,
      records,
      ownerByRequestId
    );

    nextIndexSessions[sessionId] = {
      signature: sigInfo.signature,
      lastModifiedMs: persisted.latest.lastModifiedMs || 0,
      hasUsageFile: sigInfo.hasUsageFile,
      requestClaims: claims,
      snapshot
    };

    if (snapshot) {
      nextSessions[sessionId] = applyDedupedSnapshot(persisted, snapshot);
    }
  }

  const nextIndex: DedupIndexFile = {
    schemaVersion: 1,
    updatedAt: Date.now(),
    sessions: nextIndexSessions
  };
  await saveDedupIndex(sessionRoot, nextIndex);

  return {
    sessions: nextSessions,
    dirtyCount: changedSessionIds.size + removedSessionIds.size,
    recomputedCount: recomputeSessionIds.size,
    totalSessions: sessionEntries.length,
    usedIndex: Boolean(existingIndex)
  };
}

function applyDedupedSnapshot(
  persisted: PersistedSessionState,
  snapshot: DedupedSessionSnapshot
): PersistedSessionState {
  return {
    ...persisted,
    latest: {
      ...persisted.latest,
      inputTokens: snapshot.inputTokens,
      outputTokens: snapshot.outputTokens,
      cacheReadTokens: snapshot.cacheReadTokens,
      cacheWriteTokens: snapshot.cacheWriteTokens,
      reasoningTokens: snapshot.reasoningTokens,
      totalTokens: snapshot.totalTokens,
      mode: snapshot.mode,
      evidenceCount: snapshot.evidenceCount,
      modelTotals: snapshot.modelTotals,
      modelBreakdowns: snapshot.modelBreakdowns,
      dailyBreakdowns: snapshot.dailyBreakdowns
    }
  };
}

function extractRequestClaims(sessionId: string, records: ParsedRequestRecord[]): DedupRequestClaim[] {
  const claimMap = new Map<string, boolean>();
  for (const record of records) {
    if (!record.requestId) {
      continue;
    }
    const isNative = Boolean(record.nativeCascadeId && record.nativeCascadeId === sessionId);
    const prev = claimMap.get(record.requestId);
    if (prev === undefined || (isNative && !prev)) {
      claimMap.set(record.requestId, isNative);
    }
  }
  const claims: DedupRequestClaim[] = [];
  for (const [requestId, isNative] of claimMap.entries()) {
    claims.push({ requestId, isNative });
  }
  return claims;
}

function registerClaimsOwnership(
  ownerByRequestId: Map<string, RequestOwner>,
  sessionId: string,
  sessionMtime: number,
  claims: DedupRequestClaim[]
): void {
  for (const claim of claims) {
    const currentOwner = ownerByRequestId.get(claim.requestId);
    if (!currentOwner || shouldTransferOwnership(currentOwner, sessionId, claim.isNative, sessionMtime)) {
      ownerByRequestId.set(claim.requestId, {
        sessionId,
        isNative: claim.isNative,
        lastModifiedMs: sessionMtime
      });
    }
  }
}

async function computeSessionSnapshotFromDisk(
  sessionId: string,
  persisted: PersistedSessionState,
  sessionRoot: string,
  records: ParsedRequestRecord[] | undefined,
  ownerByRequestId: Map<string, RequestOwner>
): Promise<DedupedSessionSnapshot | null> {
  const transcriptData = await readTranscriptData(sessionRoot, sessionId);

  if (!records && !transcriptData) {
    return null;
  }

  const stepTimestamps = await loadSessionStepTimestamps(sessionRoot, sessionId, transcriptData?.stepTimestamps);
  return aggregateSingleSession(
    sessionId,
    persisted,
    records,
    transcriptData,
    stepTimestamps,
    ownerByRequestId
  );
}

function aggregateSingleSession(
  sessionId: string,
  persisted: PersistedSessionState,
  records: ParsedRequestRecord[] | undefined,
  transcriptData: { calls: TranscriptCallRecord[]; stepTimestamps: Map<number, number> } | null,
  stepTimestamps: Map<number, number>,
  ownerByRequestId: Map<string, RequestOwner>
): DedupedSessionSnapshot | null {
  const totals = emptyBreakdown();
  const modelBreakdowns: Record<string, ModelTokenBreakdown> = {};
  const modelTotals: Record<string, number> = {};
  const dailyBreakdowns: Record<string, DailyTokenBreakdown> = {};
  const seenLocalIds = new Set<string>();
  const modelUsageCounts = new Map<string, number>();
  let evidenceCount = 0;
  const tRecords = transcriptData?.calls ?? [];

  if (records) {
    for (const record of records) {
      if (record.requestId) {
        const owner = ownerByRequestId.get(record.requestId);
        if (owner && owner.sessionId !== sessionId) {
          continue;
        }
        if (seenLocalIds.has(record.requestId)) {
          continue;
        }
        seenLocalIds.add(record.requestId);
      }

      const matchedTranscript = matchTranscriptCall(tRecords, record);
      const callTimestamp = resolveCallTimestamp(record, stepTimestamps, matchedTranscript?.timestamp, persisted.latest.lastModifiedMs);
      const canonicalModel = canonicalizeModelId(record.model);

      mergeInto(totals, record.breakdown);
      addModelBreakdown(modelBreakdowns, modelTotals, canonicalModel, record.breakdown);
      addDailyBreakdown(dailyBreakdowns, callTimestamp, record.breakdown, canonicalModel);
      if (canonicalModel !== 'unknown') {
        modelUsageCounts.set(canonicalModel, (modelUsageCounts.get(canonicalModel) ?? 0) + record.breakdown.totalTokens);
      }
      evidenceCount += 1;
    }
  }

  const fallbackModel = resolveDominantModel(modelUsageCounts, persisted.latest.modelTotals);
  for (const tr of tRecords) {
    if (tr.matched || tr.totalTokens <= 0) {
      continue;
    }
    const revertedBreakdown: TokenBreakdown = {
      inputTokens: tr.inputTokens,
      outputTokens: tr.outputTokens,
      cacheReadTokens: tr.cacheReadTokens,
      cacheWriteTokens: tr.cacheWriteTokens,
      reasoningTokens: 0,
      totalTokens: tr.totalTokens
    };
    mergeInto(totals, revertedBreakdown);
    addModelBreakdown(modelBreakdowns, modelTotals, fallbackModel, revertedBreakdown);
    addDailyBreakdown(dailyBreakdowns, tr.timestamp || persisted.latest.lastModifiedMs, revertedBreakdown, fallbackModel);
    evidenceCount += 1;
  }

  if (!records && evidenceCount === 0) {
    return null;
  }

  totals.totalTokens = normalizeTotal(totals);

  return {
    ...totals,
    mode: evidenceCount > 0 ? 'reported' : (records ? 'reported' : persisted.latest.mode),
    evidenceCount,
    modelTotals,
    modelBreakdowns,
    dailyBreakdowns
  };
}

function shouldTransferOwnership(
  current: RequestOwner,
  candidateSessionId: string,
  candidateIsNative: boolean,
  candidateMtime: number
): boolean {
  if (candidateIsNative !== current.isNative) {
    return candidateIsNative;
  }
  if (candidateMtime !== current.lastModifiedMs) {
    return candidateMtime < current.lastModifiedMs;
  }
  return candidateSessionId < current.sessionId;
}

function matchTranscriptCall(
  tRecords: TranscriptCallRecord[],
  record: ParsedRequestRecord
): TranscriptCallRecord | undefined {
  if (tRecords.length === 0) {
    return undefined;
  }

  const combinedOutput = record.breakdown.outputTokens + record.breakdown.reasoningTokens;
  const stepSet = record.stepIndices && record.stepIndices.length > 0 ? new Set(record.stepIndices) : undefined;

  for (const tr of tRecords) {
    if (tr.matched) {
      continue;
    }
    if (stepSet && !stepSet.has(tr.stepIndex)) {
      continue;
    }
    if (
      tr.inputTokens === record.breakdown.inputTokens
      && (tr.outputTokens === combinedOutput || tr.outputTokens === record.breakdown.outputTokens)
      && tr.cacheReadTokens === record.breakdown.cacheReadTokens
    ) {
      tr.matched = true;
      return tr;
    }
  }

  // Fallback: match by stepIndex alone only if no token-exact match existed and only 1 unmatched record at that step
  if (stepSet) {
    const candidatesAtStep = tRecords.filter((tr) => !tr.matched && stepSet.has(tr.stepIndex));
    if (candidatesAtStep.length === 1 && record.breakdown.totalTokens === candidatesAtStep[0].totalTokens) {
      candidatesAtStep[0].matched = true;
      return candidatesAtStep[0];
    }
  }

  return undefined;
}

function resolveCallTimestamp(
  record: ParsedRequestRecord,
  stepTimestamps: Map<number, number>,
  matchedTranscriptTs: number | undefined,
  fallbackModifiedMs: number
): number {
  if (record.timestamp !== undefined && Number.isFinite(record.timestamp) && record.timestamp > 1_000_000_000) {
    return record.timestamp;
  }
  if (record.stepIndices) {
    for (const sIdx of record.stepIndices) {
      const ts = stepTimestamps.get(sIdx);
      if (ts !== undefined) {
        return ts;
      }
    }
  }
  if (matchedTranscriptTs !== undefined && Number.isFinite(matchedTranscriptTs)) {
    return matchedTranscriptTs;
  }
  return fallbackModifiedMs;
}

function resolveDominantModel(
  modelUsageCounts: Map<string, number>,
  previousModelTotals?: Record<string, number>
): string {
  let bestModel = '';
  let bestTokens = -1;
  for (const [model, total] of modelUsageCounts.entries()) {
    if (total > bestTokens) {
      bestTokens = total;
      bestModel = model;
    }
  }
  if (bestModel) {
    return bestModel;
  }
  if (previousModelTotals) {
    for (const [model, total] of Object.entries(previousModelTotals)) {
      const canonical = canonicalizeModelId(model);
      if (canonical !== 'unknown' && total > bestTokens) {
        bestTokens = total;
        bestModel = canonical;
      }
    }
  }
  return bestModel || 'unknown';
}

async function readSessionUsageRecords(usagePath: string): Promise<ParsedRequestRecord[] | null> {
  let content: string;
  try {
    const stat = await fs.stat(usagePath);
    if (!stat.isFile() || stat.size === 0) {
      return null;
    }
    content = await fs.readFile(usagePath, 'utf8');
  } catch {
    return null;
  }

  const records: ParsedRequestRecord[] = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const extracted = extractCanonicalUsageFields(parsed);
      if (!extracted || extracted.breakdown.totalTokens <= 0) {
        continue;
      }

      records.push({
        requestId: extracted.requestId,
        nativeCascadeId: extracted.nativeCascadeId,
        timestamp: extracted.timestamp,
        stepIndices: extracted.stepIndices,
        model: extracted.model,
        breakdown: extracted.breakdown
      });
    } catch {
    }
  }

  return records;
}

async function readTranscriptData(
  sessionRoot: string,
  sessionId: string
): Promise<{ calls: TranscriptCallRecord[]; stepTimestamps: Map<number, number> } | null> {
  const transcriptPath = path.join(sessionRoot, 'brain', sessionId, '.system_generated', 'logs', 'transcript.jsonl');
  let content: string;
  try {
    const stat = await fs.stat(transcriptPath);
    if (!stat.isFile() || stat.size === 0) {
      return null;
    }
    content = await fs.readFile(transcriptPath, 'utf8');
  } catch {
    return null;
  }

  const stepTimestamps = new Map<number, number>();
  const calls: TranscriptCallRecord[] = [];
  const seenCalls = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      const stepIndex = typeof obj.step_index === 'number' ? obj.step_index : -1;
      const ts = typeof obj.created_at === 'string' ? Date.parse(obj.created_at) : NaN;
      if (stepIndex >= 0 && Number.isFinite(ts)) {
        stepTimestamps.set(stepIndex, ts);
      }
      if (obj.type === 'PLANNER_RESPONSE') {
        const inputTokens = toNonNegNumber(obj.input_tokens);
        const outputTokens = toNonNegNumber(obj.output_tokens);
        const cacheReadTokens = toNonNegNumber(obj.cache_read_tokens);
        const cacheWriteTokens = toNonNegNumber(obj.cache_creation_tokens ?? obj.cache_write_tokens);
        const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
        if (totalTokens > 0) {
          const dedupKey = `${stepIndex}|${String(obj.created_at ?? '')}|${inputTokens}|${outputTokens}|${cacheReadTokens}|${cacheWriteTokens}`;
          if (!seenCalls.has(dedupKey)) {
            seenCalls.add(dedupKey);
            calls.push({
              stepIndex,
              timestamp: Number.isFinite(ts) ? ts : 0,
              inputTokens,
              outputTokens,
              cacheReadTokens,
              cacheWriteTokens,
              totalTokens,
              matched: false
            });
          }
        }
      }
    } catch {
    }
  }

  return calls.length > 0 || stepTimestamps.size > 0 ? { calls, stepTimestamps } : null;
}

async function loadSessionStepTimestamps(
  sessionRoot: string,
  sessionId: string,
  transcriptTimestamps?: Map<number, number>
): Promise<Map<number, number>> {
  const stepTimestamps = new Map<number, number>();

  // 1. From SQLite steps table if db exists
  const dbPath = path.join(sessionRoot, 'conversations', `${sessionId}.db`);
  if (fsSync.existsSync(dbPath)) {
    try {
      const DatabaseSyncCtor = require('node:sqlite')?.DatabaseSync;
      if (typeof DatabaseSyncCtor === 'function') {
        const db = new DatabaseSyncCtor(dbPath, { open: true, readOnly: true });
        try {
          const rows = db.prepare('SELECT idx, metadata FROM steps').all() as Array<{
            idx: number;
            metadata: Uint8Array | Buffer | null;
          }>;
          for (const row of rows) {
            const ts = extractProtoStepTimestampMs(row.metadata);
            if (ts !== undefined) {
              stepTimestamps.set(row.idx, ts);
            }
          }
        } finally {
          db.close();
        }
      }
    } catch {
    }
  }

  // 2. From rpc-cache steps.jsonl if available
  const stepsPath = path.join(sessionRoot, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'steps.jsonl');
  try {
    const content = await fs.readFile(stepsPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as Record<string, unknown>;
        if (typeof obj.stepIndex === 'number' && typeof obj.timestamp === 'number' && obj.timestamp > 1_000_000_000) {
          if (!stepTimestamps.has(obj.stepIndex)) {
            stepTimestamps.set(obj.stepIndex, obj.timestamp);
          }
        }
      } catch {
      }
    }
  } catch {
  }

  // 3. Merge transcript.jsonl timestamps
  if (transcriptTimestamps) {
    for (const [idx, ts] of transcriptTimestamps.entries()) {
      stepTimestamps.set(idx, ts);
    }
  }

  return stepTimestamps;
}

function extractProtoStepTimestampMs(rawMeta: Uint8Array | Buffer | null): number | undefined {
  if (!rawMeta || rawMeta.byteLength === 0) {
    return undefined;
  }
  const buf = Buffer.from(rawMeta);
  const f1 = decodeProtoField1Sub(buf);
  if (!f1) {
    return undefined;
  }
  const sec = decodeProtoVarintField1(f1);
  if (sec !== undefined && sec > 1_000_000_000) {
    return sec * 1000;
  }
  return undefined;
}

function decodeProtoField1Sub(buffer: Buffer): Buffer | undefined {
  let offset = 0;
  while (offset < buffer.length) {
    let tag = 0n;
    let shift = 0n;
    while (offset < buffer.length) {
      const b = buffer[offset++];
      tag |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
      if (shift > 63n) return undefined;
    }
    const fn = Number(tag >> 3n);
    const wt = Number(tag & 0x7n);
    if (wt === 0) {
      while (offset < buffer.length && (buffer[offset++] & 0x80) !== 0) {}
    } else if (wt === 2) {
      let len = 0n;
      let s = 0n;
      while (offset < buffer.length) {
        const b = buffer[offset++];
        len |= BigInt(b & 0x7f) << s;
        if ((b & 0x80) === 0) break;
        s += 7n;
        if (s > 35n) return undefined;
      }
      const byteLen = Number(len);
      if (fn === 1 && offset + byteLen <= buffer.length) {
        return buffer.subarray(offset, offset + byteLen);
      }
      offset += byteLen;
    } else if (wt === 1) {
      offset += 8;
    } else if (wt === 5) {
      offset += 4;
    } else {
      break;
    }
  }
  return undefined;
}

function decodeProtoVarintField1(buffer: Buffer): number | undefined {
  let offset = 0;
  while (offset < buffer.length) {
    let tag = 0n;
    let shift = 0n;
    while (offset < buffer.length) {
      const b = buffer[offset++];
      tag |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7n;
      if (shift > 63n) return undefined;
    }
    const fn = Number(tag >> 3n);
    const wt = Number(tag & 0x7n);
    if (wt === 0) {
      let val = 0n;
      let s = 0n;
      while (offset < buffer.length) {
        const b = buffer[offset++];
        val |= BigInt(b & 0x7f) << s;
        if ((b & 0x80) === 0) break;
        s += 7n;
        if (s > 63n) return undefined;
      }
      if (fn === 1) return Number(val);
    } else {
      break;
    }
  }
  return undefined;
}

function toNonNegNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function addModelBreakdown(
  modelBreakdowns: Record<string, ModelTokenBreakdown>,
  modelTotals: Record<string, number>,
  model: string,
  breakdown: TokenBreakdown
): void {
  const next = modelBreakdowns[model] ?? emptyBreakdown();
  mergeInto(next, breakdown);
  next.totalTokens = normalizeTotal(next);
  modelBreakdowns[model] = next;
  modelTotals[model] = next.totalTokens;
}

function addDailyBreakdown(
  dailyBreakdowns: Record<string, DailyTokenBreakdown>,
  timestampMs: number,
  breakdown: TokenBreakdown,
  model?: string
): void {
  if (!timestampMs || !Number.isFinite(timestampMs) || timestampMs <= 0) {
    return;
  }
  const dateKey = formatLocalDateKey(timestampMs);
  const bucket = dailyBreakdowns[dateKey] ?? { ...emptyBreakdown(), messageCount: 0, modelBreakdowns: {} };
  mergeInto(bucket, breakdown);
  bucket.totalTokens = normalizeTotal(bucket);
  bucket.messageCount += 1;
  if (model) {
    bucket.modelBreakdowns ??= {};
    const modelBucket = bucket.modelBreakdowns[model] ?? emptyBreakdown();
    mergeInto(modelBucket, breakdown);
    modelBucket.totalTokens = normalizeTotal(modelBucket);
    bucket.modelBreakdowns[model] = modelBucket;
  }
  dailyBreakdowns[dateKey] = bucket;
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

function mergeInto(target: TokenBreakdown, source: TokenBreakdown): void {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.cacheReadTokens += source.cacheReadTokens;
  target.cacheWriteTokens += source.cacheWriteTokens;
  target.reasoningTokens += source.reasoningTokens;
  target.totalTokens += source.totalTokens;
}
