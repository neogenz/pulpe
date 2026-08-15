import { SITE_URL } from "./routes";
import type { Locale } from "./i18n";

export const ANGULAR_APP_URL = process.env.NEXT_PUBLIC_ANGULAR_APP_URL || "";

// Partagés entre le markup de l'en-tête et le script inline du layout qui le
// pilote avant que React n'ait hydraté.
export const SCROLL_SENTINEL_ID = "scroll-sentinel";
export const MOBILE_NAV_ID = "mobile-nav";
export const MOBILE_NAV_PANEL_ID = "mobile-nav-panel";
export const DESKTOP_BREAKPOINT_PX = 1024;
export const GITHUB_URL = "https://github.com/neogenz/pulpe";
export const IOS_APP_URL = "https://apps.apple.com/app/pulpe/id6758464920";
// Single schema.org entity in the root @graph. Articles reference its @id as
// publisher, and this shared constant keeps both sides aligned. `SITE_URL` lives
// in `routes.ts`, which owns every URL the four languages resolve against.
export const ORGANIZATION_ID = `${SITE_URL}/#org`;
export const CONTACT_EMAIL = "maxime.desogus@gmail.com";

export function angularUrl(
  path: string,
  utmContent: string,
  locale: Locale,
): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${ANGULAR_APP_URL}${path}${separator}utm_source=landing&utm_medium=cta&utm_content=${encodeURIComponent(utmContent)}&lang=${locale}`;
}
