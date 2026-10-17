import 'server-only';
import { listKeys, readJson, writeJsonCas } from './storage';
import { AuditDoc, auditKey, type AuditEntry } from './schemas/logs';

export type { AuditEntry };

/** Max entries kept per monthly audit doc. */
const CAP = 5000;

/**
 * Append to `audit/{yyyy-mm}.json`. Best-effort: never throws, so it cannot
 * break the action it records. CAS with retries (writeJsonCas).
 */
export async function audit(entry: Omit<AuditEntry, 'ts'>): Promise<void> {
  const now = new Date();
  const row: AuditEntry = {
    ts: now.toISOString(),
    actor: entry.actor.slice(0, 64),
    action: entry.action.slice(0, 64),
    target: entry.target?.slice(0, 128),
    detail: entry.detail?.slice(0, 256),
  };
  try {
    await writeJsonCas(
      auditKey(now),
      AuditDoc,
      (cur) => {
        const entries = [...(cur?.entries ?? []), row];
        return { entries: entries.length > CAP ? entries.slice(-CAP) : entries };
      },
      { initial: () => ({ entries: [] }) },
    );
  } catch (err) {
    console.error('audit: entry dropped', row.action, err instanceof Error ? err.message : '');
  }
}

/** Most recent entries first, across the latest monthly docs. */
export async function readAudit(limit = 100): Promise<AuditEntry[]> {
  try {
    const keys = (await listKeys('audit/')).map((k) => k.key).sort().reverse();
    const out: AuditEntry[] = [];
    for (const key of keys) {
      const doc = await readJson(key, AuditDoc);
      out.push(...[...(doc?.entries ?? [])].reverse());
      if (out.length >= limit) break;
    }
    return out.slice(0, limit);
  } catch {
    return [];
  }
}
