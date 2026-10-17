import { StaticPageView, loadStaticPage, staticPageMetadata } from '../_static/StaticPage';

export const dynamic = 'force-dynamic';

export function generateMetadata() {
  return staticPageMetadata('about');
}

export default async function Page() {
  const { page, vars } = await loadStaticPage('about');
  return <StaticPageView slug="about" page={page} vars={vars} />;
}
