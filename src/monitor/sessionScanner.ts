import * as fs from 'fs/promises';
import type { Dirent, Stats } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { SessionScanCandidate, SessionScanResult } from '../types';


const EXCLUDED_NAMES = new Set(['.ds_store', 'thumbs.db', 'transcript_full.jsonl']);
const EXCLUDED_BRAIN_DIRS = new Set(['tempmediastorage']);
const TEXT_EXTENSIONS = new Set(['.json', '.jsonl', '.md', '.txt', '.log', '.yaml', '.yml']);

export class SessionScanner {
  async scan(sessionRoot: string): Promise<SessionScanResult> {
    const brainDir = path.join(sessionRoot, 'brain');
    const conversationsDir = path.join(sessionRoot, 'conversations');
    const resolvedSessionRoot = await safeRealpath(sessionRoot) ?? path.resolve(sessionRoot);

    const dirEntries = await safeReadDir(brainDir);
    if (!dirEntries.ok) {
      return { sessions: [], complete: false, error: dirEntries.error ?? `Failed to read ${brainDir}` };
    }

    const candidateIds = new Set<string>();
    const brainDirIds = new Set<string>();
    for (const entry of dirEntries.entries) {
      if (!entry.isDirectory() || EXCLUDED_BRAIN_DIRS.has(entry.name.toLowerCase())) {
        continue;
      }
      candidateIds.add(entry.name);
      brainDirIds.add(entry.name);
    }

    const convEntries = await safeReadDir(conversationsDir);
    if (convEntries.ok) {
      for (const entry of convEntries.entries) {
        if (!entry.isFile()) {
          continue;
        }
        const match = entry.name.match(/^(.+)\.(db|pb)$/i);
        if (match?.[1]) {
          candidateIds.add(match[1]);
        }
      }
    }

    const sessions: SessionScanCandidate[] = [];

    for (const sessionId of candidateIds) {
      const sessionDir = path.join(brainDir, sessionId);
      let filePaths: string[] = [];
      if (brainDirIds.has(sessionId)) {
        const collected = await collectFiles(sessionDir, resolvedSessionRoot);
        if (!collected.ok) {
          return { sessions: [], complete: false, error: collected.error ?? `Failed to read ${sessionDir}` };
        }
        // Only include files with parseable text extensions
        filePaths = collected.files.filter((f) => TEXT_EXTENSIONS.has(path.extname(f).toLowerCase()));
      }

      const pbPath = path.join(conversationsDir, `${sessionId}.pb`);
      const pbStat = await safeStat(pbPath);
      if (pbStat) {
        filePaths.push(pbPath);
      }

      const dbPath = path.join(conversationsDir, `${sessionId}.db`);
      const dbStat = await safeStat(dbPath);
      if (dbStat) {
        filePaths.push(dbPath);
      }

      const walPath = path.join(conversationsDir, `${sessionId}.db-wal`);
      const walStat = await safeStat(walPath);

      if (filePaths.length === 0) {
        continue;
      }

      let lastModifiedMs = 0;
      const signatureParts: string[] = [];
      for (const filePath of filePaths) {
        const stat = await safeStat(filePath);
        if (!stat) {
          continue;
        }

        const mtimeMs = Number(stat.mtimeMs);
        const size = Number(stat.size);
        lastModifiedMs = Math.max(lastModifiedMs, mtimeMs);
        signatureParts.push(`${filePath}:${size}:${Math.round(mtimeMs)}`);
      }

      if (walStat && Number(walStat.size) > 0) {
        const walMtimeMs = Number(walStat.mtimeMs);
        lastModifiedMs = Math.max(lastModifiedMs, walMtimeMs);
        signatureParts.push(`${walPath}:${Number(walStat.size)}:${Math.round(walMtimeMs)}`);
      }

      if (signatureParts.length === 0) {
        continue;
      }

      sessions.push({
        sessionId,
        sessionDir,
        pbPath: pbStat ? pbPath : undefined,
        filePaths: filePaths.sort(),
        labelHint: sessionId,
        lastModifiedMs,
        signature: createHash('sha1').update(signatureParts.join('|')).digest('hex')
      });
    }

    sessions.sort((a, b) => b.lastModifiedMs - a.lastModifiedMs);
    return { sessions, complete: true };
  }
}

async function collectFiles(dirPath: string, resolvedSessionRoot: string): Promise<{ ok: true; files: string[] } | { ok: false; error?: string }> {
  const files: string[] = [];
  const entries = await safeReadDir(dirPath);
  if (!entries.ok) {
    return { ok: false, error: entries.error };
  }

  for (const entry of entries.entries) {
    if (EXCLUDED_NAMES.has(entry.name.toLowerCase()) || entry.name.endsWith('~')) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.toLowerCase() === 'chunks' && path.basename(dirPath).toLowerCase() === 'logs') {
        continue;
      }
      // Security: validate symlink doesn't escape sessionRoot
      try {
        const realPath = await fs.realpath(fullPath);
        if (!isPathWithinRoot(realPath, resolvedSessionRoot)) {
          console.warn(`[Scanner] Symlink escapes sessionRoot: ${fullPath} -> ${realPath}`);
          continue;
        }
      } catch {}

      const nested = await collectFiles(fullPath, resolvedSessionRoot);
      if (!nested.ok) {
        return nested;
      }

      files.push(...nested.files);
      continue;
    }

    // Security: validate symlink doesn't escape sessionRoot for files too
    try {
      const realPath = await fs.realpath(fullPath);
      if (!isPathWithinRoot(realPath, resolvedSessionRoot)) {
        console.warn(`[Scanner] Symlink escapes sessionRoot: ${fullPath} -> ${realPath}`);
        continue;
      }
    } catch {}

    files.push(fullPath);
  }

  return { ok: true, files };
}

function isPathWithinRoot(targetPath: string, resolvedRoot: string): boolean {
  const normalizedTarget = process.platform === 'win32' ? path.resolve(targetPath).toLowerCase() : path.resolve(targetPath);
  const normalizedRoot = process.platform === 'win32' ? path.resolve(resolvedRoot).toLowerCase() : path.resolve(resolvedRoot);
  const rel = path.relative(normalizedRoot, normalizedTarget);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function safeRealpath(targetPath: string): Promise<string | undefined> {
  try {
    return await fs.realpath(targetPath);
  } catch {
    return undefined;
  }
}

async function safeReadDir(dirPath: string): Promise<{ ok: true; entries: Dirent[] } | { ok: false; error?: string }> {
  try {
    return { ok: true, entries: await fs.readdir(dirPath, { withFileTypes: true }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : undefined };
  }
}

async function safeStat(filePath: string): Promise<Stats | null> {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}
