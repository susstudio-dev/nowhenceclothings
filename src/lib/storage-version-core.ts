import { createHash } from 'node:crypto';

// Pure versioning decisions, extracted so they are testable without a Worker
// or a filesystem. `nodejs_compat` is enabled for this project, so node:crypto
// resolves in both Node and workerd — though the hash path is only exercised
// by the dev/filesystem backend (R2 supplies its own etag).

export interface DocMeta {
  lineage: string;
  rev: number;
}

export function hashOf(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('base64');
}

/** Dev-backend compare-and-swap: the write proceeds only when the bytes on
 *  disk still hash to what the caller read. `null` = no sidecar yet, i.e. the
 *  first versioned write of a pre-existing document. */
export function mayWrite(currentText: string, expected: { hash: string } | null): boolean {
  return expected === null || hashOf(currentText) === expected.hash;
}

/** Reads {lineage, rev} out of R2 custom metadata. Documents written before
 *  versioning existed have none: they read as the `legacy` lineage at rev 0,
 *  which is distinct from any generated lineage and so can never be mistaken
 *  for one. */
export function parseMeta(custom: Record<string, string> | undefined): DocMeta {
  const rev = Number(custom?.rev);
  return {
    lineage: custom?.lineage || 'legacy',
    rev: Number.isInteger(rev) && rev >= 0 ? rev : 0,
  };
}

/** A restore starts a NEW lineage so that every tab, draft and open editor
 *  holding a pre-restore version token fails its check loudly instead of
 *  applying to content it was never diffed against. */
export function newLineage(): string {
  return crypto.randomUUID();
}

/** The opaque token handed to (and echoed back by) the admin client. */
export function versionToken(meta: DocMeta): string {
  return `${meta.lineage}:${meta.rev}`;
}
