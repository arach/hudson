import type { Metadata } from "next";
import { canonicalUrl } from "../../site/seo";
import { SiteRoot } from '@/marketing/SiteRoot';
import { DEFAULTS } from '@/marketing/theme/defaults';
import { resolveThemeStyle } from '@/marketing/theme/resolve';

export const metadata: Metadata = { alternates: { canonical: canonicalUrl("/") } };

export default function Page() {
  const themeStyle = resolveThemeStyle({ ...DEFAULTS });
  return <SiteRoot themeStyle={themeStyle} initialState={{ ...DEFAULTS }} />;
}
