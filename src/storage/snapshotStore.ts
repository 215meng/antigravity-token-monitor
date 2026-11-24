import * as fs from 'fs/promises';
import * as path from 'path';
import { PersistedSessionState, PersistedState } from '../types';

const STATE_FILE_NAME = 'monitor-state.json';
const ARCHIVE_FILE_PREFIX = 'monitor-state.archive-';
const ARCHIVE_FILE_SUFFIX = '.json';

export class SnapshotStore {
  private saveLock = false;
  constructor(private readonly storageDir: string) {}

  async load(): Promise<PersistedState> {
    const storageDir = this.getStorageDirectoryPath();
    try {
      await fs.mkdir(storageDir, { recursive: true });
      const activeState = await this.loadJsonFile(this.getStateFilePath());
      const archiveStates = await this.loadArchiveStates(storageDir);

      return {
        lastPollAt: activeState?.lastPollAt,
        sessions: mergeSessionMaps([
          ...archiveStates.map((state) => state.sessions),
          activeState?.sessions ?? {}
        ])
      };
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;
      if (fileError.code === 'ENOENT') {
        return { sessions: {} };
      }

      console.warn('[antigravity-token-monitor] Failed to load state:', error);
      return { sessions: {} };
    }
  }

  async save(state: PersistedState): Promise<void> {
    if (this.saveLock) {
      console.warn('[antigravity-token-monitor] Save skipped: already in progress');
      return;
    }
    this.saveLock = true;
    try {
      const storageDir = this.getStorageDirectoryPath();
      await fs.mkdir(storageDir, { recursive: true });

      const activeSessions: PersistedState['sessions'] = {};
      const archivedByMonth = new Map<string, PersistedState['sessions']>();

      for (const [sessionId, session] of Object.entries(state.sessions)) {
        if (session.lifecycle.status === 'archived') {
          const archiveMonth = resolveArchiveMonth(session);
          const bucket = archivedByMonth.get(archiveMonth) ?? {};
          bucket[sessionId] = session;
          archivedByMonth.set(archiveMonth, bucket);
          continue;
        }

        activeSessions[sessionId] = session;
      }

      // Atomic write: use temp file + rename to prevent corruption on crash/disk-full
      const tmpPath = `${this.getStateFilePath()}.tmp.${Date.now()}`;
      await fs.writeFile(tmpPath, JSON.stringify({ lastPollAt: state.lastPollAt, sessions: activeSessions }, null, 2), 'utf8');
      await fs.rename(tmpPath, this.getStateFilePath());

      const expectedArchiveFiles = new Set<string>();
      for (const [archiveMonth, sessions] of archivedByMonth) {
        const filePath = this.getArchiveFilePath(archiveMonth);
        expectedArchiveFiles.add(filePath);
        // 合并磁盘上已有的归档数据，绝不无故覆盖丢失历史会话
        const existingShard = await this.loadJsonFile(filePath);
        const mergedShard = { ...existingShard?.sessions, ...sessions };

        // 如果某个会话已经重新激活为 active，则从归档分片中剔除
        for (const activeId of Object.keys(activeSessions)) {
          delete mergedShard[activeId];
        }

        if (Object.keys(mergedShard).length > 0) {
          await fs.writeFile(filePath, JSON.stringify({ sessions: mergedShard }, null, 2), 'utf8');
        } else {
          // 如果分片已完全被重新激活清空，才允许移除
          await fs.unlink(filePath).catch(() => {});
        }
      }

      const existingArchiveFiles = await this.listArchiveFilePaths(storageDir);
      // 只有当现有归档分片中的会话全部已激活（或为空）时，才清理空分片，绝不误删历史月份数据
      for (const filePath of existingArchiveFiles) {
        if (!expectedArchiveFiles.has(filePath)) {
          const shard = await this.loadJsonFile(filePath);
          let hasRemainingArchived = false;
          if (shard?.sessions) {
            for (const [sid, sess] of Object.entries(shard.sessions)) {
              if (!activeSessions[sid] && sess.lifecycle?.status === 'archived') {
                hasRemainingArchived = true;
                break;
              }
            }
          }
          if (!hasRemainingArchived) {
            await fs.unlink(filePath).catch((err) => console.warn(`[Store] Failed to delete obsolete empty ${filePath}:`, err));
          }
        }
      }
    } finally {
      this.saveLock = false;
    }
  }

  private async loadArchiveStates(storageDir: string): Promise<PersistedState[]> {
    const filePaths = await this.listArchiveFilePaths(storageDir);
    const results: PersistedState[] = [];
    for (const filePath of filePaths) {
      try {
        const state = await this.loadJsonFile(filePath);
        if (state) results.push(state);
      } catch (error) {
        console.warn(`[antigravity-token-monitor] Failed to load archive ${filePath}:`, error);
      }
    }
    return results;
  }

  private async loadJsonFile(filePath: string): Promise<PersistedState | undefined> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as PersistedState;
    } catch (error) {
      const fileError = error as NodeJS.ErrnoException;
      if (fileError.code === 'ENOENT') {
        return undefined;
      }

      throw error;
    }
  }

  private async listArchiveFilePaths(storageDir: string): Promise<string[]> {
    const entries = await fs.readdir(storageDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.startsWith(ARCHIVE_FILE_PREFIX) && entry.name.endsWith(ARCHIVE_FILE_SUFFIX))
      .map((entry) => path.join(storageDir, entry.name))
      .sort();
  }

  private getArchiveFilePath(archiveMonth: string): string {
    return path.join(this.getStorageDirectoryPath(), `${ARCHIVE_FILE_PREFIX}${archiveMonth}${ARCHIVE_FILE_SUFFIX}`);
  }

  private getStorageDirectoryPath(): string {
    return this.storageDir;
  }

  private getStateFilePath(): string {
    return path.join(this.storageDir, STATE_FILE_NAME);
  }
}

function mergeSessionMaps(sessionMaps: Array<Record<string, PersistedSessionState>>): Record<string, PersistedSessionState> {
  return Object.assign({}, ...sessionMaps);
}

function resolveArchiveMonth(session: PersistedSessionState): string {
  const archivedAt = session.lifecycle.archivedAt ?? session.lifecycle.lastSeenAt;
  // Validate timestamp to prevent NaN-NaN paths
  if (!archivedAt || archivedAt <= 0) {
    console.warn(`[antigravity-token-monitor] Invalid archivedAt for session ${session.latest.sessionId}, using current month`);
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  const date = new Date(archivedAt);
  if (isNaN(date.getTime())) {
    console.warn(`[antigravity-token-monitor] Invalid date for session ${session.latest.sessionId}, using current month`);
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
