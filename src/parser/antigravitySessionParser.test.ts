import { describe, expect, it } from 'vitest';
import { AntigravitySessionParser } from './antigravitySessionParser';
import type { SessionParsePlan } from '../types';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

describe('AntigravitySessionParser', () => {
  it('prefers observed response output tokens over serialized zero values', async () => {
    const sessionDir = await mkdtemp(path.join(tmpdir(), 'antigravity-parser-'));
    const usagePath = path.join(sessionDir, 'usage.jsonl');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      usagePath,
      `${JSON.stringify({
        recordType: 'usage',
        model: 'gemini-3.1-pro-high',
        inputTokens: 10,
        outputTokens: 0,
        totalTokens: 15,
        raw: {
          chatModel: {
            usage: {
              inputTokens: 10,
              responseOutputTokens: 5,
              totalTokens: 15
            }
          }
        }
      })}\n`,
      'utf8'
    );

    const parsePlan: SessionParsePlan = {
      sessionId: 'session-1',
      sessionDir,
      labelHint: 'Session 1',
      lastModifiedMs: Date.now(),
      tokenFilePaths: [usagePath],
      analysisSignature: 'sig',
      source: 'rpc-artifact'
    };

    const result = await new AntigravitySessionParser(1024 * 1024).parse(parsePlan);

    expect(result.outputTokens).toBe(5);
    expect(result.totalTokens).toBe(15);
    expect(result.modelBreakdowns?.['gemini-3.1-pro-high']?.outputTokens).toBe(5);
  });

  it('counts all exported step rows as messages', async () => {
    const sessionDir = await mkdtemp(path.join(tmpdir(), 'antigravity-parser-'));
    const usagePath = path.join(sessionDir, 'usage.jsonl');
    const stepsPath = path.join(sessionDir, 'steps.jsonl');
    await mkdir(sessionDir, { recursive: true });
    await writeFile(
      usagePath,
      `${JSON.stringify({
        recordType: 'usage',
        model: 'gemini-2.5-pro',
        inputTokens: 5,
        outputTokens: 5,
        totalTokens: 10
      })}\n`,
      'utf8'
    );

    await writeFile(
      stepsPath,
      [
        JSON.stringify({
          recordType: 'step',
          type: 'CORTEX_STEP_TYPE_USER_INPUT',
          role: 'user',
          text: 'Hello'
        }),
        JSON.stringify({
          recordType: 'step',
          type: 'CORTEX_STEP_TYPE_MODEL_RESPONSE',
          role: 'model',
          text: 'Hi there'
        }),
        JSON.stringify({
          recordType: 'step',
          type: 'CORTEX_STEP_TYPE_CLEARED',
          role: 'model',
          text: 'clear marker'
        })
      ].join('\n') + '\n',
      'utf8'
    );

    const parsePlan: SessionParsePlan = {
      sessionId: 'session-step-count',
      sessionDir,
      labelHint: 'Session with steps',
      lastModifiedMs: Date.now(),
      tokenFilePaths: [usagePath, stepsPath],
      analysisSignature: 'sig2',
      source: 'rpc-artifact'
    };

    const result = await new AntigravitySessionParser(1024 * 1024).parse(parsePlan);

    expect(result.messageCount).toBe(3);
    expect(result.inputTokens).toBe(5);
    expect(result.outputTokens).toBe(5);
    expect(result.totalTokens).toBe(10);
  });

  it('splits thinking tokens from output tokens without double counting and ignores fallback usage in steps.jsonl when usage.jsonl exists', async () => {
    const sessionDir = await mkdtemp(path.join(tmpdir(), 'antigravity-parser-'));
    const usagePath = path.join(sessionDir, 'usage.jsonl');
    const stepsPath = path.join(sessionDir, 'steps.jsonl');
    await mkdir(sessionDir, { recursive: true });

    await writeFile(
      usagePath,
      `${JSON.stringify({
        recordType: 'usage',
        model: 'gemini-3.8-flash',
        timestamp: Date.parse('2026-11-16T08:00:00Z'),
        // Intentionally corrupted top-level doubled values from legacy cache
        inputTokens: 200,
        outputTokens: 50,
        cacheReadTokens: 1000,
        totalTokens: 1250,
        raw: {
          stepIndices: [1],
          chatModel: {
            usage: {
              inputTokens: '100',
              outputTokens: '25',
              responseOutputTokens: '10',
              thinkingOutputTokens: '15',
              cacheReadTokens: '500',
              responseId: 'resp-1'
            }
          }
        }
      })}\n`,
      'utf8'
    );

    await writeFile(
      stepsPath,
      `${JSON.stringify({
        recordType: 'step',
        stepIndex: 1,
        role: 'model',
        timestamp: Date.parse('2026-11-16T08:00:00Z'),
        inputTokens: 100,
        outputTokens: 25,
        cacheReadTokens: 500,
        totalTokens: 625
      })}\n`,
      'utf8'
    );

    const parsePlan: SessionParsePlan = {
      sessionId: 'session-no-double',
      sessionDir,
      labelHint: 'No double count',
      lastModifiedMs: Date.parse('2026-11-17T08:00:00Z'),
      tokenFilePaths: [usagePath, stepsPath],
      analysisSignature: 'sig-no-double',
      source: 'rpc-artifact'
    };

    const result = await new AntigravitySessionParser(1024 * 1024).parse(parsePlan);

    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(10);
    expect(result.reasoningTokens).toBe(15);
    expect(result.cacheReadTokens).toBe(500);
    expect(result.totalTokens).toBe(625);
    expect(result.dailyBreakdowns?.['2026-11-16']?.totalTokens).toBe(625);
    expect(result.dailyBreakdowns?.['2026-11-17']).toBeUndefined();
  });

});
