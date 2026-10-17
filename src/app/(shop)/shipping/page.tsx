import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('shipping');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('shipping');
  return <StaticPageView slug="shipping" page={page} vars={vars} />;
}
