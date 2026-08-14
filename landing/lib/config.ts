export const ANGULAR_APP_URL = process.env.NEXT_PUBLIC_ANGULAR_APP_URL || "";

// Partagés entre le markup de l'en-tête et le script inline du layout qui le
// pilote avant que React n'ait hydraté.
export const SCROLL_SENTINEL_ID = "scroll-sentinel";
export const MOBILE_NAV_ID = "mobile-nav";
export const MOBILE_NAV_PANEL_ID = "mobile-nav-panel";
export const DESKTOP_BREAKPOINT_PX = 1024;
export const GITHUB_URL = "https://github.com/neogenz/pulpe";
export const IOS_APP_URL = "https://apps.apple.com/app/pulpe/id6758464920";
export const SITE_URL = "https://pulpe.app";
// Entité schema.org unique du @graph racine ; les articles la référencent par
// @id comme publisher. Constante partagée pour que les deux côtés ne divergent pas.
export const ORGANIZATION_ID = `${SITE_URL}/#org`;
export const CONTACT_EMAIL = "maxime.desogus@gmail.com";

export function angularUrl(path: string, utmContent: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${ANGULAR_APP_URL}${path}${separator}utm_source=landing&utm_medium=cta&utm_content=${encodeURIComponent(utmContent)}`;
}
