import { mkdtemp, mkdir, readFile, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { describe, expect, it } from 'vitest';
import type { PersistedSessionState } from '../types';
import { getDedupIndexPath } from './dedupIndex';
import {
  deduplicateSessionsFromArtifacts,
  deduplicateSessionsIncremental
} from './responseDeduplicator';

function makeSession(sessionId: string, lastModifiedMs: number): PersistedSessionState {
  return {
    signature: `sig-${sessionId}`,
    latest: {
      sessionId,
      label: sessionId,
      filePath: `/tmp/${sessionId}`,
      lastModifiedMs,
      mode: 'reported',
      source: 'rpc-artifact',
      evidenceCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0
    },
    snapshots: [],
    lifecycle: {
      status: 'active',
      lastSeenAt: lastModifiedMs
    }
  };
}

function makeUsageLine(opts: {
  sessionId: string;
  nativeCascadeId: string;
  timestamp: number;
  responseId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  stepIndices?: number[];
}): string {
  return JSON.stringify({
    recordType: 'usage',
    sessionId: opts.sessionId,
    timestamp: opts.timestamp,
    raw: {
      stepIndices: opts.stepIndices ?? [1],
      chatModel: {
        responseModel: 'gemini-3.8-flash-n',
        customMetadata: { cascade_id: opts.nativeCascadeId },
        usage: {
          inputTokens: String(opts.inputTokens),
          outputTokens: String(opts.outputTokens),
          cacheReadTokens: String(opts.cacheReadTokens ?? 0),
          responseId: opts.responseId
        }
      }
    }
  });
}

function assertStrictlyEquivalent(
  incremental: Record<string, PersistedSessionState>,
  full: Record<string, PersistedSessionState>
): void {
  expect(Object.keys(incremental).sort()).toEqual(Object.keys(full).sort());
  for (const sessionId of Object.keys(full)) {
    expect(incremental[sessionId].latest).toEqual(full[sessionId].latest);
  }
}

describe('deduplicateSessionsIncremental', () => {
  it('matches full deduplication across cold build, zero-change fast path, single-session edit, addition, and deletion ownership transfer', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'antigravity-inc-dedup-'));
    const parentId = 'session-parent';
    const childId = 'session-child';
    const independentId = 'session-independent';

    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', parentId), { recursive: true });
    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', childId), { recursive: true });
    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', independentId), { recursive: true });
    await mkdir(path.join(root, 'brain', parentId, '.system_generated', 'logs'), { recursive: true });

    const t1 = Date.parse('2026-11-20T10:00:00+08:00');
    const t2 = Date.parse('2026-11-21T11:00:00+08:00');
    const t3 = Date.parse('2026-11-22T12:00:00+08:00');

    const sharedLineForParent = makeUsageLine({
      sessionId: parentId,
      nativeCascadeId: parentId,
      timestamp: t1,
      responseId: 'resp-shared',
      inputTokens: 1000,
      outputTokens: 200,
      cacheReadTokens: 500
    });
    const sharedLineForChild = makeUsageLine({
      sessionId: childId,
      nativeCascadeId: parentId,
      timestamp: t1,
      responseId: 'resp-shared',
      inputTokens: 1000,
      outputTokens: 200,
      cacheReadTokens: 500
    });
    const childOwnLine = makeUsageLine({
      sessionId: childId,
      nativeCascadeId: childId,
      timestamp: t2,
      responseId: 'resp-child-1',
      inputTokens: 300,
      outputTokens: 100
    });
    const indLine = makeUsageLine({
      sessionId: independentId,
      nativeCascadeId: independentId,
      timestamp: t2,
      responseId: 'resp-ind-1',
      inputTokens: 400,
      outputTokens: 50
    });

    await writeFile(path.join(root, '.token-monitor', 'rpc-cache', 'v1', parentId, 'usage.jsonl'), `${sharedLineForParent}\n`, 'utf8');
    await writeFile(path.join(root, '.token-monitor', 'rpc-cache', 'v1', childId, 'usage.jsonl'), `${sharedLineForChild}\n${childOwnLine}\n`, 'utf8');
    await writeFile(path.join(root, '.token-monitor', 'rpc-cache', 'v1', independentId, 'usage.jsonl'), `${indLine}\n`, 'utf8');
    await writeFile(
      path.join(root, 'brain', parentId, '.system_generated', 'logs', 'transcript.jsonl'),
      `${JSON.stringify({
        step_index: 2,
        type: 'PLANNER_RESPONSE',
        created_at: '2026-11-21T09:00:00+08:00',
        input_tokens: 150,
        output_tokens: 50,
        cache_read_tokens: 0
      })}\n`,
      'utf8'
    );

    const sessions1: Record<string, PersistedSessionState> = {
      [parentId]: makeSession(parentId, t2),
      [childId]: makeSession(childId, t2),
      [independentId]: makeSession(independentId, t2)
    };

    // 1. Cold build
    const full1 = await deduplicateSessionsFromArtifacts(sessions1, root);
    const inc1 = await deduplicateSessionsIncremental(sessions1, root);
    expect(inc1.recomputedCount).toBe(3);
    expect(inc1.usedIndex).toBe(false);
    assertStrictlyEquivalent(inc1.sessions, full1);

    // 2. Zero-change second call -> 0 dirty, 0 recomputed
    const inc2 = await deduplicateSessionsIncremental(sessions1, root);
    expect(inc2.usedIndex).toBe(true);
    expect(inc2.dirtyCount).toBe(0);
    expect(inc2.recomputedCount).toBe(0);
    assertStrictlyEquivalent(inc2.sessions, full1);

    // 3. Edit only child session + add new session
    const addedId = 'session-added';
    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', addedId), { recursive: true });
    await writeFile(
      path.join(root, '.token-monitor', 'rpc-cache', 'v1', childId, 'usage.jsonl'),
      `${sharedLineForChild}\n${childOwnLine}\n${makeUsageLine({
        sessionId: childId,
        nativeCascadeId: childId,
        timestamp: t3,
        responseId: 'resp-child-2',
        inputTokens: 600,
        outputTokens: 100
      })}\n`,
      'utf8'
    );
    await writeFile(
      path.join(root, '.token-monitor', 'rpc-cache', 'v1', addedId, 'usage.jsonl'),
      `${makeUsageLine({
        sessionId: addedId,
        nativeCascadeId: addedId,
        timestamp: t3,
        responseId: 'resp-added-1',
        inputTokens: 800,
        outputTokens: 200
      })}\n`,
      'utf8'
    );

    const sessions3: Record<string, PersistedSessionState> = {
      [parentId]: makeSession(parentId, t2),
      [childId]: makeSession(childId, t3),
      [independentId]: makeSession(independentId, t2),
      [addedId]: makeSession(addedId, t3)
    };
    const full3 = await deduplicateSessionsFromArtifacts(sessions3, root);
    const inc3 = await deduplicateSessionsIncremental(sessions3, root);
    expect(inc3.usedIndex).toBe(true);
    expect(inc3.recomputedCount).toBe(2); // only childId + addedId
    assertStrictlyEquivalent(inc3.sessions, full3);

    // 4. Delete parent session -> ownership of `resp-shared` transfers to childId even though childId files didn't change
    const sessions4: Record<string, PersistedSessionState> = {
      [childId]: makeSession(childId, t3),
      [independentId]: makeSession(independentId, t2),
      [addedId]: makeSession(addedId, t3)
    };
    const full4 = await deduplicateSessionsFromArtifacts(sessions4, root);
    const inc4 = await deduplicateSessionsIncremental(sessions4, root);
    expect(inc4.usedIndex).toBe(true);
    expect(inc4.recomputedCount).toBe(1); // childId inherited resp-shared; independent & added untouched
    assertStrictlyEquivalent(inc4.sessions, full4);
    expect(inc4.sessions[childId].latest.totalTokens).toBe(full4[childId].latest.totalTokens);
    expect(inc4.sessions[childId].latest.totalTokens).toBe(1700 + 400 + 700);
  });

  it('automatically recovers when dedup index file is corrupted or has mismatched schemaVersion', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'antigravity-inc-corrupt-'));
    const sessionId = 'session-1';
    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', sessionId), { recursive: true });
    const t1 = Date.parse('2026-11-22T10:00:00+08:00');
    await writeFile(
      path.join(root, '.token-monitor', 'rpc-cache', 'v1', sessionId, 'usage.jsonl'),
      `${makeUsageLine({
        sessionId,
        nativeCascadeId: sessionId,
        timestamp: t1,
        responseId: 'resp-1',
        inputTokens: 900,
        outputTokens: 100
      })}\n`,
      'utf8'
    );

    const sessions = { [sessionId]: makeSession(sessionId, t1) };
    const full = await deduplicateSessionsFromArtifacts(sessions, root);

    // Corrupt index JSON
    await writeFile(getDedupIndexPath(root), '{ broken json', 'utf8');
    const recoveredFromCorrupt = await deduplicateSessionsIncremental(sessions, root);
    expect(recoveredFromCorrupt.usedIndex).toBe(false);
    expect(recoveredFromCorrupt.recomputedCount).toBe(1);
    assertStrictlyEquivalent(recoveredFromCorrupt.sessions, full);

    // Wrong schemaVersion
    const saved = JSON.parse(await readFile(getDedupIndexPath(root), 'utf8')) as Record<string, unknown>;
    await writeFile(getDedupIndexPath(root), JSON.stringify({ ...saved, schemaVersion: 999 }), 'utf8');
    const recoveredFromVersion = await deduplicateSessionsIncremental(sessions, root);
    expect(recoveredFromVersion.usedIndex).toBe(false);
    expect(recoveredFromVersion.recomputedCount).toBe(1);
    assertStrictlyEquivalent(recoveredFromVersion.sessions, full);
  });
});
