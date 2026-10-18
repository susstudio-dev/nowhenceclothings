import { preorderFaq } from '@/components/shop/presale-copy';
import { heroPresaleProduct } from '@/components/shop/quick-buy';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings } from '@/lib/content';
import { productsFor } from '@/lib/launches-server';
import type { Page as StaticPage } from '@/lib/schemas/site-content';
import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('faq');
}

/**
 * While a pre-order is open, its two booking questions ("How does the pre-order work?", "Can I cancel a
 * reservation?") join the FAQ after the shipping answers. They are read from the live launch config, so the
 * amounts and dates are always the ones checkout uses, and they disappear when the pre-order closes.
 */
function withPreorderQuestions(page: StaticPage, extra: { q: string; a: string }[]): StaticPage {
  if (!extra.length) return page;
  let done = false;
  const blocks = page.blocks.map((b) => {
    if (done || b.type !== 'faq') return b;
    done = true;
    const asked = new Set(b.items.map((i) => i.q.toLowerCase()));
    const add = extra.filter((x) => !asked.has(x.q.toLowerCase()));
    const at = Math.min(3, b.items.length);
    return { ...b, items: [...b.items.slice(0, at), ...add, ...b.items.slice(at)] };
  });
  return { ...page, blocks };
}

export default async function Page() {
  const [{ page, vars }, settings, catalogue] = await Promise.all([loadStaticPage('faq'), getSettings(), getCatalogue()]);
  const piece = heroPresaleProduct(productsFor(catalogue, settings.launches, 'shop'));
  const exchange = settings.returns.exchangesAllowed ? { days: settings.returns.windowDays } : undefined;
  const extra = piece ? preorderFaq(piece, { exchange }).slice(0, 2) : [];
  return <StaticPageView slug="faq" page={withPreorderQuestions(page, extra)} vars={vars} />;
}
