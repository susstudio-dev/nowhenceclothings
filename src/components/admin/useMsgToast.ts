'use client';

import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';

/** Mirrors a component's success message into a studio toast. */
export function useMsgToast(msg: { ok: boolean; text: string } | null): void {
  const toast = useToast();
  useEffect(() => {
    if (msg?.ok && msg.text) toast({ title: msg.text, tone: 'success' });
  }, [msg, toast]);
}
