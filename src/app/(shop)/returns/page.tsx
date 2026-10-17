import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('returns');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('returns');
  return <StaticPageView slug="returns" page={page} vars={vars} />;
}
