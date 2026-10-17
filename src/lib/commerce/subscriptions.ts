// Back-in-stock / drop alerts and newsletter signups (CAS append, deduped).

import 'server-only';
import { writeJsonCas } from '@/lib/storage';
import { NEWSLETTER_KEY, NewsletterDoc, NotifyDoc, notifyKey } from '@/lib/schemas/logs';

const CAP = 20000;

/** Returns true when newly added, false when already subscribed. */
export async function subscribeNotify(
  sku: string,
  email: string,
  kind: 'restock' | 'drop',
  key: string = notifyKey(sku),
): Promise<boolean> {
  const mail = email.trim().toLowerCase();
  let added = false;
  await writeJsonCas(
    key,
    NotifyDoc,
    (cur) => {
      const subs = cur?.subscribers ?? [];
      added = !subs.some((s) => s.email === mail && !s.notifiedAt);
      if (!added) return { subscribers: subs };
      return { subscribers: [...subs, { email: mail, at: new Date().toISOString(), kind }].slice(-CAP) };
    },
    { initial: () => ({ subscribers: [] }) },
  );
  return added;
}

export async function subscribeNewsletter(email: string, source: string, key: string = NEWSLETTER_KEY): Promise<boolean> {
  const mail = email.trim().toLowerCase();
  let added = false;
  await writeJsonCas(
    key,
    NewsletterDoc,
    (cur) => {
      const signups = cur?.signups ?? [];
      added = !signups.some((s) => s.email === mail);
      if (!added) return { signups };
      return { signups: [...signups, { email: mail, at: new Date().toISOString(), source }].slice(-CAP) };
    },
    { initial: () => ({ signups: [] }) },
  );
  return added;
}
