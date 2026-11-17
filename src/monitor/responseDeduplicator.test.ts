import { describe, expect, it } from 'vitest';
import { deduplicateSessionsFromArtifacts } from './responseDeduplicator';
import { PersistedSessionState } from '../types';
import { mkdtemp, mkdir, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

function makePersistedSession(sessionId: string, lastModifiedMs: number): PersistedSessionState {
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

describe('deduplicateSessionsFromArtifacts', () => {
  it('assigns cloned responseIds to native parent session, fuses reverted transcript calls, and computes per-day breakdowns', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'antigravity-dedup-'));
    const parentId = 'parent-session';
    const childId = 'child-subagent';

    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', parentId), { recursive: true });
    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', childId), { recursive: true });
    await mkdir(path.join(root, 'brain', parentId, '.system_generated', 'logs'), { recursive: true });

    const parentDay1Ts = Date.parse('2026-11-15T10:00:00+08:00');
    const parentDay2Ts = Date.parse('2026-11-16T10:00:00+08:00');
    const childDay2Ts = Date.parse('2026-11-16T15:00:00+08:00');

    const sharedUsageRecord = {
      recordType: 'usage',
      sessionId: parentId,
      timestamp: parentDay1Ts,
      raw: {
        stepIndices: [1],
        chatModel: {
          responseModel: 'gemini-3.8-flash-n',
          customMetadata: { cascade_id: parentId },
          usage: {
            inputTokens: '1000',
            outputTokens: '300',
            responseOutputTokens: '100',
            thinkingOutputTokens: '200',
            cacheReadTokens: '2000',
            responseId: 'resp-shared-1'
          }
        }
      }
    };

    const parentSecondRecord = {
      recordType: 'usage',
      sessionId: parentId,
      timestamp: parentDay2Ts,
      raw: {
        stepIndices: [3],
        chatModel: {
          responseModel: 'gemini-3.8-flash-n',
          customMetadata: { cascade_id: parentId },
          usage: {
            inputTokens: '500',
            outputTokens: '100',
            cacheReadTokens: '0',
            responseId: 'resp-parent-2'
          }
        }
      }
    };

    const childOwnRecord = {
      recordType: 'usage',
      sessionId: childId,
      timestamp: childDay2Ts,
      raw: {
        stepIndices: [5],
        chatModel: {
          responseModel: 'gemini-3.8-flash-n',
          customMetadata: { cascade_id: childId },
          usage: {
            inputTokens: '200',
            outputTokens: '50',
            cacheReadTokens: '100',
            responseId: 'resp-child-own'
          }
        }
      }
    };

    await writeFile(
      path.join(root, '.token-monitor', 'rpc-cache', 'v1', parentId, 'usage.jsonl'),
      `${JSON.stringify(sharedUsageRecord)}\n${JSON.stringify(parentSecondRecord)}\n`,
      'utf8'
    );

    // Child subagent has cloned parent history + its own call
    await writeFile(
      path.join(root, '.token-monitor', 'rpc-cache', 'v1', childId, 'usage.jsonl'),
      `${JSON.stringify({ ...sharedUsageRecord, sessionId: childId })}\n${JSON.stringify(childOwnRecord)}\n`,
      'utf8'
    );

    // Parent transcript includes exact current call at step 1 + one reverted earlier retry at step 1 on Nov 16
    await writeFile(
      path.join(root, 'brain', parentId, '.system_generated', 'logs', 'transcript.jsonl'),
      [
        JSON.stringify({
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          created_at: '2026-11-15T10:00:00+08:00',
          input_tokens: 1000,
          output_tokens: 300,
          cache_read_tokens: 2000
        }),
        JSON.stringify({
          step_index: 1,
          type: 'PLANNER_RESPONSE',
          created_at: '2026-11-16T09:30:00+08:00',
          input_tokens: 400,
          output_tokens: 50,
          cache_read_tokens: 500
        })
      ].join('\n') + '\n',
      'utf8'
    );

    const inputSessions: Record<string, PersistedSessionState> = {
      [parentId]: makePersistedSession(parentId, Date.parse('2026-11-17T08:00:00+08:00')),
      [childId]: makePersistedSession(childId, childDay2Ts)
    };

    const result = await deduplicateSessionsFromArtifacts(inputSessions, root);

    // Parent owns shared (3300) + parentSecond (600) + reverted transcript call (950) = 4850
    expect(result[parentId].latest.totalTokens).toBe(4850);
    expect(result[parentId].latest.dailyBreakdowns?.['2026-11-15']?.totalTokens).toBe(3300);
    expect(result[parentId].latest.dailyBreakdowns?.['2026-11-16']?.totalTokens).toBe(1550);
    expect(result[parentId].latest.dailyBreakdowns?.['2026-11-17']).toBeUndefined();

    // Child only keeps its own call (350)
    expect(result[childId].latest.totalTokens).toBe(350);
    expect(result[childId].latest.dailyBreakdowns?.['2026-11-16']?.totalTokens).toBe(350);
  });

  it('clears pre-deduplication dailyBreakdowns when a cloned subagent has zero remaining tokens', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'antigravity-dedup-empty-'));
    const parentId = 'parent-1';
    const cloneId = 'clone-1';

    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', parentId), { recursive: true });
    await mkdir(path.join(root, '.token-monitor', 'rpc-cache', 'v1', cloneId), { recursive: true });

    const ts = Date.parse('2026-11-16T12:00:00+08:00');
    const sharedRecord = {
      recordType: 'usage',
      sessionId: parentId,
      timestamp: ts,
      raw: {
        chatModel: {
          responseModel: 'gemini-3.8-flash-n',
          customMetadata: { cascade_id: parentId },
          usage: { inputTokens: '500', outputTokens: '100', responseId: 'resp-only-parent' }
        }
      }
    };

    await writeFile(path.join(root, '.token-monitor', 'rpc-cache', 'v1', parentId, 'usage.jsonl'), `${JSON.stringify(sharedRecord)}\n`, 'utf8');
    await writeFile(path.join(root, '.token-monitor', 'rpc-cache', 'v1', cloneId, 'usage.jsonl'), `${JSON.stringify({ ...sharedRecord, sessionId: cloneId })}\n`, 'utf8');

    const cloneSession = makePersistedSession(cloneId, ts);
    cloneSession.latest.dailyBreakdowns = {
      '2026-11-16': { inputTokens: 500, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0, totalTokens: 600, messageCount: 1 }
    };

    const result = await deduplicateSessionsFromArtifacts(
      {
        [parentId]: makePersistedSession(parentId, ts),
        [cloneId]: cloneSession
      },
      root
    );

    expect(result[parentId].latest.totalTokens).toBe(600);
    expect(result[cloneId].latest.totalTokens).toBe(0);
    expect(result[cloneId].latest.dailyBreakdowns).toEqual({});
  });
});
