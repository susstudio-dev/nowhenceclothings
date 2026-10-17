import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('faq');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('faq');
  return <StaticPageView slug="faq" page={page} vars={vars} />;
}
