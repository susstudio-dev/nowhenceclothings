import type { ReactNode } from 'react';
import { Footer, Header, headerActionClass, resolveAnnouncement, shortDate, type PresaleTarget } from '@/components/chrome';
import { CartButton } from '@/components/shop/cart-drawer';
import { NewsletterForm } from '@/components/shop/NewsletterForm';
import { countdownFor } from '@/components/shop/presale-copy';
import { heroPresaleProduct } from '@/components/shop/quick-buy';
import { getCatalogue } from '@/lib/catalogue';
import { getSettings, getSiteContent } from '@/lib/content';
import { productsFor } from '@/lib/launches-server';
import type { SettingsDoc } from '@/lib/schemas/settings';
import type { SiteContentDoc } from '@/lib/schemas/site-content';
import { jsonLdScript, organizationLd, webSiteLd } from '@/lib/jsonld';
import { withReturnsNavLabel } from '@/lib/static-pages';
import { socialUrl } from '@/lib/seo';
import { displayPhone, instagramHandle, whatsappUrl } from '@/lib/store-copy';

/**
 * The open pre-order piece the header status links to when the owner gave the announcement
 * no link. Only read when it can matter; projected products only (A10 secrecy).
 */
async function presaleTarget(a: SiteContentDoc['announcement'], settings: SettingsDoc): Promise<PresaleTarget | undefined> {
  if (!a.enabled || !a.text.trim() || a.href?.trim()) return undefined;
  try {
    const product = heroPresaleProduct(productsFor(await getCatalogue(), settings.launches, 'shop'));
    if (!product) return undefined;
    const c = countdownFor(product.launch);
    const date = c ? shortDate(c.at) : '';
    return { slug: product.slug, note: c && date ? `${c.label} ${date}` : undefined };
  } catch {
    return undefined;
  }
}

// Header renders the skip link and the announcement; CartButton mounts the single CartDrawer.
export default async function ShopLayout({ children }: { children: ReactNode }) {
  const [content, settings] = await Promise.all([getSiteContent(), getSettings()]);
  const brand = {
    name: settings.store.name,
    wordmark: settings.brand.wordmark,
    logoLight: settings.brand.logoLight,
    logoDark: settings.brand.logoDark,
  };
  const announcement = resolveAnnouncement(content.announcement, await presaleTarget(content.announcement, settings));
  const wa = whatsappUrl(settings.store.phone);
  const ig = socialUrl(settings.store.instagram, 'instagram');
  const igHandle = instagramHandle(settings.store.instagram);
  const footerColumns = content.nav.footer.map((col) => ({ ...col, links: withReturnsNavLabel(col.links, settings) }));
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript([organizationLd(settings), webSiteLd()]) }}
      />
      <Header
        nav={content.nav.primary}
        cartSlot={<CartButton variant="text" className={headerActionClass} />}
        brand={brand}
        announcement={announcement}
        menuColumns={footerColumns}
      />
      <main id="main">{children}</main>
      <Footer columns={footerColumns} newsletter={<NewsletterForm source="footer" />} email={settings.store.email}
        whatsapp={wa ? { href: wa, label: displayPhone(settings.store.phone) } : undefined}
        instagram={ig && igHandle ? { href: ig, label: igHandle } : undefined}
        brand={brand}
        legalName={settings.legal.legalName || undefined}
      />
    </>
  );
}
