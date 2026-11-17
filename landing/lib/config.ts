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
// Identifies the developer account in App Store Connect campaign links (`pt`).
// Read from a link generated in App Analytics > Acquisition > Campaigns.
export const APP_STORE_PROVIDER_TOKEN = "128500600";
// App Store Connect caps a campaign token at 30 characters.
const CAMPAIGN_TOKEN_MAX_LENGTH = 30;
// The About page: the group home shows a permission error to a signed-out visitor.
export const ANDROID_BETA_GROUP_URL =
  "https://groups.google.com/g/pulpe-android-beta/about";
// L'adresse du serveur MCP, celle qu'un assistant reçoit telle quelle. Le
// tutoriel l'affiche et la commande du terminal la reprend : une seule source
// évite qu'un des deux reste sur une ancienne adresse.
export const MCP_SERVER_URL = "https://api.pulpe.app/mcp";
// Single schema.org entity in the root @graph. Articles reference its @id as
// publisher, and this shared constant keeps both sides aligned. `SITE_URL` lives
// in `routes.ts`, which owns every URL the four languages resolve against.
export const ORGANIZATION_ID = `${SITE_URL}/#org`;
export const CONTACT_EMAIL = "maxime.desogus@gmail.com";

/**
 * The App Store link with App Store Connect campaign parameters, so installs
 * can be traced back to the campaign that brought the visitor to the landing.
 * `utmCampaign` is the landing arrival URL's `utm_campaign`; without one, the
 * install is credited to the landing itself.
 */
export function appStoreCampaignUrl(utmCampaign: string | null): string {
  const campaign =
    (utmCampaign ?? "")
      .replace(/[^A-Za-z0-9 ._-]/g, "")
      .slice(0, CAMPAIGN_TOKEN_MAX_LENGTH)
      .trim() || "landing";
  const url = new URL(IOS_APP_URL);
  url.searchParams.set("pt", APP_STORE_PROVIDER_TOKEN);
  url.searchParams.set("ct", campaign);
  url.searchParams.set("mt", "8");
  return url.toString();
}

export function angularUrl(
  path: string,
  utmContent: string,
  locale: Locale,
): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${ANGULAR_APP_URL}${path}${separator}utm_source=landing&utm_medium=cta&utm_content=${encodeURIComponent(utmContent)}&lang=${locale}`;
}
