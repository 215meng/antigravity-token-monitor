import * as fs from 'fs';
import * as path from 'path';

type ProtoField = {
  fieldNo: number;
  wireType: number;
  val?: number;
  sub?: Buffer;
};

export type SqliteTrajectoryPayload = {
  steps: unknown[];
  metadata: unknown[];
  lastModifiedMs?: number;
};

/**
 * Reads persisted steps and generator metadata directly from Antigravity's
 * local SQLite database (`conversations/<sessionId>.db`) when RPC omits them.
 */
export function readSqliteTrajectoryPayload(
  sessionRoot: string,
  sessionId: string
): SqliteTrajectoryPayload | null {
  const dbPath = path.join(sessionRoot, 'conversations', `${sessionId}.db`);
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  let DatabaseSyncCtor: any;
  try {
    // Load dynamically so Node <22 test environments or missing sqlite fail cleanly
    DatabaseSyncCtor = require('node:sqlite')?.DatabaseSync;
  } catch {
    return null;
  }

  if (typeof DatabaseSyncCtor !== 'function') {
    return null;
  }

  let db: any;
  try {
    db = new DatabaseSyncCtor(dbPath, { open: true, readOnly: true });
    const { steps, stepTimestampByIndex } = readStepsTable(db);
    const metadata = readGeneratorMetadataTable(db, stepTimestampByIndex);

    if (steps.length === 0 && metadata.length === 0) {
      return null;
    }

    let lastModifiedMs: number | undefined;
    for (const step of steps) {
      if (step && typeof step === 'object' && typeof (step as { timestamp?: unknown }).timestamp === 'number') {
        const ts = (step as { timestamp: number }).timestamp;
        lastModifiedMs = lastModifiedMs === undefined ? ts : Math.max(lastModifiedMs, ts);
      }
    }

    return { steps, metadata, lastModifiedMs };
  } catch {
    return null;
  } finally {
    try {
      db?.close();
    } catch {
    }
  }
}

function readStepsTable(db: any): { steps: unknown[]; stepTimestampByIndex: Map<number, number> } {
  const stepTimestampByIndex = new Map<number, number>();
  try {
    const rows = db.prepare('SELECT idx, step_type, metadata FROM steps ORDER BY idx').all() as Array<{
      idx: number;
      step_type: number;
      metadata: Uint8Array | Buffer | null;
    }>;

    const steps = rows.map((row) => {
      const timestamp = extractStepTimestampMs(row.metadata);
      if (timestamp !== undefined) {
        stepTimestampByIndex.set(row.idx, timestamp);
      }
      return {
        stepIndex: row.idx,
        type: mapStepType(row.step_type),
        ...(timestamp !== undefined ? { timestamp } : {})
      };
    });
    return { steps, stepTimestampByIndex };
  } catch {
    return { steps: [], stepTimestampByIndex };
  }
}

function readGeneratorMetadataTable(db: any, stepTimestampByIndex: Map<number, number>): unknown[] {
  try {
    const rows = db.prepare('SELECT idx, data FROM gen_metadata ORDER BY idx').all() as Array<{
      idx: number;
      data: Uint8Array | Buffer | null;
    }>;

    const results: unknown[] = [];
    for (const row of rows) {
      if (!row.data) {
        continue;
      }
      const parsed = decodeGenMetadataEntry(Buffer.from(row.data), stepTimestampByIndex);
      if (parsed) {
        results.push(parsed);
      }
    }
    return results;
  } catch {
    return [];
  }
}

function extractStepTimestampMs(rawMeta: Uint8Array | Buffer | null): number | undefined {
  if (!rawMeta || rawMeta.byteLength === 0) {
    return undefined;
  }
  const fields = decodeProto(Buffer.from(rawMeta));
  const tsField = fields.find((f) => f.fieldNo === 1 && f.wireType === 2 && f.sub);
  if (!tsField?.sub) {
    return undefined;
  }
  const tsSub = decodeProto(tsField.sub);
  const seconds = tsSub.find((f) => f.fieldNo === 1 && f.wireType === 0)?.val;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 1_000_000_000) {
    return seconds * 1000;
  }
  return undefined;
}

function mapStepType(stepType: number): string {
  if (stepType === 14) {
    return 'CORTEX_STEP_TYPE_USER_INPUT';
  }
  if (stepType === 15) {
    return 'CORTEX_STEP_TYPE_PLANNER_RESPONSE';
  }
  return `CORTEX_STEP_TYPE_${stepType}`;
}

function decodeGenMetadataEntry(
  buf: Buffer,
  stepTimestampByIndex: Map<number, number>
): Record<string, unknown> | null {
  const topFields = decodeProto(buf);
  const chatModelField = topFields.find((f) => f.fieldNo === 1 && f.wireType === 2 && f.sub);
  if (!chatModelField?.sub) {
    return null;
  }

  const stepIndices = extractStepIndices(topFields);
  let timestamp: number | undefined;
  for (const stepIdx of stepIndices) {
    const stepTs = stepTimestampByIndex.get(stepIdx);
    if (stepTs !== undefined) {
      timestamp = stepTs;
      break;
    }
  }

  const cmFields = decodeProto(chatModelField.sub);
  const modelEnum = findVarint(cmFields, 3);
  const responseModel = findUtf8String(cmFields, 19);
  const modelDisplayName = findUtf8String(cmFields, 21);
  const usageSub = cmFields.find((f) => f.fieldNo === 4 && f.wireType === 2 && f.sub)?.sub;
  const customMetadata = extractCustomMetadata(cmFields);

  const modelStr = formatEnumPlaceholder(modelEnum);
  const chatModel: Record<string, unknown> = {};
  if (modelStr) {
    chatModel.model = modelStr;
  }
  if (responseModel) {
    chatModel.responseModel = responseModel;
  }
  if (modelDisplayName) {
    chatModel.modelDisplayName = modelDisplayName;
  }
  if (customMetadata) {
    chatModel.customMetadata = customMetadata;
  }

  if (usageSub) {
    const uFields = decodeProto(usageSub);
    const usageModelEnum = findVarint(uFields, 1) ?? modelEnum;
    const inputTokens = findVarint(uFields, 2) ?? 0;
    const outputTokens = findVarint(uFields, 3) ?? 0;
    const cacheWriteTokens = findVarint(uFields, 4) ?? 0;
    const cacheReadTokens = findVarint(uFields, 5) ?? 0;
    const messageId = findUtf8String(uFields, 7);
    const thinkingOutputTokens = findVarint(uFields, 9) ?? 0;
    const responseOutputTokens = findVarint(uFields, 10) ?? 0;
    const responseId = findUtf8String(uFields, 11);

    const usageObj: Record<string, unknown> = {
      inputTokens: String(inputTokens),
      outputTokens: String(outputTokens),
      cacheWriteTokens: String(cacheWriteTokens),
      cacheReadTokens: String(cacheReadTokens),
      thinkingOutputTokens: String(thinkingOutputTokens),
      responseOutputTokens: String(responseOutputTokens)
    };
    const usageModelStr = formatEnumPlaceholder(usageModelEnum);
    if (usageModelStr) {
      usageObj.model = usageModelStr;
    }
    if (messageId) {
      usageObj.messageId = messageId;
    }
    if (responseId) {
      usageObj.responseId = responseId;
    }
    chatModel.usage = usageObj;
  }

  return {
    ...(stepIndices.length > 0 ? { stepIndices } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
    ...(responseModel ? { responseModel } : {}),
    chatModel
  };
}

function extractStepIndices(topFields: ProtoField[]): number[] {
  const indices: number[] = [];
  for (const field of topFields) {
    if (field.fieldNo !== 2) {
      continue;
    }
    if (field.wireType === 0 && field.val !== undefined) {
      indices.push(field.val);
    } else if (field.wireType === 2 && field.sub) {
      let offset = 0;
      const limit = field.sub.length;
      while (offset < limit) {
        let val = 0n;
        let shift = 0n;
        while (offset < limit) {
          const b = field.sub[offset++];
          val |= BigInt(b & 0x7f) << shift;
          if ((b & 0x80) === 0) {
            break;
          }
          shift += 7n;
          if (shift > 63n) {
            return indices;
          }
        }
        const num = Number(val);
        if (Number.isSafeInteger(num)) {
          indices.push(num);
        }
      }
    }
  }
  return indices;
}

function extractCustomMetadata(cmFields: ProtoField[]): Record<string, string> | undefined {
  const metadata: Record<string, string> = {};
  for (const field of cmFields) {
    if (field.fieldNo !== 20 || field.wireType !== 2 || !field.sub) {
      continue;
    }
    const entryFields = decodeProto(field.sub);
    const key = findUtf8String(entryFields, 1);
    const value = findUtf8String(entryFields, 2);
    if (key && value !== undefined) {
      metadata[key] = value;
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function formatEnumPlaceholder(enumValue: number | undefined): string | undefined {
  if (enumValue === undefined || !Number.isFinite(enumValue)) {
    return undefined;
  }
  if (enumValue >= 1000) {
    return `MODEL_PLACEHOLDER_M${enumValue - 1000}`;
  }
  return String(enumValue);
}

function findVarint(fields: ProtoField[], fieldNo: number): number | undefined {
  return fields.find((f) => f.fieldNo === fieldNo && f.wireType === 0)?.val;
}

function findUtf8String(fields: ProtoField[], fieldNo: number): string | undefined {
  const sub = fields.find((f) => f.fieldNo === fieldNo && f.wireType === 2)?.sub;
  if (!sub || sub.length === 0) {
    return undefined;
  }
  const text = sub.toString('utf8').trim();
  return text.length > 0 ? text : undefined;
}

function decodeProto(buffer: Buffer): ProtoField[] {
  let offset = 0;
  const fields: ProtoField[] = [];
  const limit = buffer.length;

  while (offset < limit) {
    let tag = 0n;
    let shift = 0n;
    while (offset < limit) {
      const b = buffer[offset++];
      tag |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) {
        break;
      }
      shift += 7n;
      if (shift > 63n) {
        return fields;
      }
    }

    const fieldNo = Number(tag >> 3n);
    const wireType = Number(tag & 0x7n);
    if (fieldNo <= 0) {
      break;
    }

    if (wireType === 0) {
      let val = 0n;
      let s = 0n;
      while (offset < limit) {
        const b = buffer[offset++];
        val |= BigInt(b & 0x7f) << s;
        if ((b & 0x80) === 0) {
          break;
        }
        s += 7n;
        if (s > 63n) {
          return fields;
        }
      }
      fields.push({ fieldNo, wireType, val: Number(val) });
    } else if (wireType === 2) {
      let len = 0n;
      let s = 0n;
      while (offset < limit) {
        const b = buffer[offset++];
        len |= BigInt(b & 0x7f) << s;
        if ((b & 0x80) === 0) {
          break;
        }
        s += 7n;
        if (s > 35n) {
          return fields;
        }
      }
      const byteLen = Number(len);
      if (!Number.isSafeInteger(byteLen) || byteLen < 0 || offset + byteLen > limit) {
        break;
      }
      const sub = buffer.subarray(offset, offset + byteLen);
      offset += byteLen;
      fields.push({ fieldNo, wireType, sub });
    } else if (wireType === 1) {
      if (offset + 8 > limit) {
        break;
      }
      offset += 8;
    } else if (wireType === 5) {
      if (offset + 4 > limit) {
        break;
      }
      offset += 4;
    } else {
      break;
    }
  }

  return fields;
}
