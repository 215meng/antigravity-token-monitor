import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  DailyTokenBreakdown,
  ModelTokenBreakdown,
  PersistedSessionState,
  TokenMode
} from '../types';

export const DEDUP_INDEX_SCHEMA_VERSION = 1;

export type DedupRequestClaim = {
  requestId: string;
  isNative: boolean;
};

export type DedupedSessionSnapshot = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  mode: TokenMode;
  evidenceCount: number;
  modelTotals: Record<string, number>;
  modelBreakdowns: Record<string, ModelTokenBreakdown>;
  dailyBreakdowns: Record<string, DailyTokenBreakdown>;
};

export type DedupSessionIndexEntry = {
  signature: string;
  lastModifiedMs: number;
  hasUsageFile: boolean;
  requestClaims: DedupRequestClaim[];
  /** `null` means checked with no artifact changes required (passthrough); object means deduplicated snapshot. */
  snapshot: DedupedSessionSnapshot | null;
};

export type DedupIndexFile = {
  schemaVersion: number;
  updatedAt: number;
  sessions: Record<string, DedupSessionIndexEntry>;
};

export type SessionArtifactSignature = {
  signature: string;
  hasUsageFile: boolean;
};

export function getDedupIndexPath(sessionRoot: string): string {
  return path.join(sessionRoot, '.token-monitor', 'dedup-index.v1.json');
}

export async function loadDedupIndex(sessionRoot: string): Promise<DedupIndexFile | null> {
  const filePath = getDedupIndexPath(sessionRoot);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DedupIndexFile> | null;
    if (
      !parsed
      || typeof parsed !== 'object'
      || parsed.schemaVersion !== DEDUP_INDEX_SCHEMA_VERSION
      || !parsed.sessions
      || typeof parsed.sessions !== 'object'
      || Array.isArray(parsed.sessions)
    ) {
      return null;
    }

    return {
      schemaVersion: DEDUP_INDEX_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      sessions: parsed.sessions
    };
  } catch {
    return null;
  }
}

export async function saveDedupIndex(sessionRoot: string, index: DedupIndexFile): Promise<void> {
  const filePath = getDedupIndexPath(sessionRoot);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const payload = JSON.stringify(index);
  const tmpPath = `${filePath}.tmp.${process.pid}.${Date.now()}`;
  await fs.writeFile(tmpPath, payload, 'utf8');
  try {
    await fs.rename(tmpPath, filePath);
  } catch {
    // Retry once on transient Windows file lock, then clean up temp file if still failing
    try {
      await fs.rm(filePath, { force: true });
      await fs.rename(tmpPath, filePath);
    } catch (error) {
      await fs.rm(tmpPath, { force: true }).catch(() => {});
      throw error;
    }
  }
}

export async function clearDedupIndex(sessionRoot: string): Promise<void> {
  const filePath = getDedupIndexPath(sessionRoot);
  try {
    await fs.rm(filePath, { force: true });
  } catch {
  }
}

async function statSignature(filePath: string): Promise<{ exists: boolean; sig: string }> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return { exists: false, sig: '0:0' };
    }
    return {
      exists: stat.size > 0,
      sig: `${stat.size}:${Math.trunc(stat.mtimeMs)}`
    };
  } catch {
    return { exists: false, sig: '0:0' };
  }
}

export async function computeSessionArtifactSignature(
  sessionRoot: string,
  sessionId: string,
  persistedLastModifiedMs: number
): Promise<SessionArtifactSignature> {
  const usagePath = path.join(sessionRoot, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'usage.jsonl');
  const transcriptPath = path.join(sessionRoot, 'brain', sessionId, '.system_generated', 'logs', 'transcript.jsonl');
  const stepsPath = path.join(sessionRoot, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'steps.jsonl');
  const dbPath = path.join(sessionRoot, 'conversations', `${sessionId}.db`);

  const [usageStat, transcriptStat, stepsStat, dbStat] = await Promise.all([
    statSignature(usagePath),
    statSignature(transcriptPath),
    statSignature(stepsPath),
    statSignature(dbPath)
  ]);

  const normalizedMtime = Number.isFinite(persistedLastModifiedMs) ? persistedLastModifiedMs : 0;
  return {
    hasUsageFile: usageStat.exists,
    signature: `${normalizedMtime}|u=${usageStat.sig}|t=${transcriptStat.sig}|s=${stepsStat.sig}|d=${dbStat.sig}`
  };
}

export async function collectSessionSignatures(
  sessionRoot: string,
  sessions: Record<string, PersistedSessionState>,
  concurrency = 32
): Promise<Map<string, SessionArtifactSignature>> {
  const entries = Object.entries(sessions);
  const result = new Map<string, SessionArtifactSignature>();
  if (entries.length === 0) {
    return result;
  }

  const workerCount = Math.max(1, Math.min(concurrency, entries.length));
  let cursor = 0;

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < entries.length) {
      const idx = cursor;
      cursor += 1;
      const [sessionId, persisted] = entries[idx];
      const sig = await computeSessionArtifactSignature(
        sessionRoot,
        sessionId,
        persisted.latest.lastModifiedMs || 0
      );
      result.set(sessionId, sig);
    }
  });

  await Promise.all(workers);
  return result;
}
