import type { MetadataRoute } from "next";
import { GUIDES } from "@/components/guides/guides";
import { DE_GUIDES } from "@/components/guides/guides.de";
import { LOCALES } from "@/lib/i18n";
import {
  ADVICE_INDEX_ROUTE,
  CALCULATOR_ROUTE,
  DE_ADVICE_SECTION_PATH,
  alternatesFor,
  localizedPath,
  ROUTES,
  SITE_URL,
  TRUST_ROUTES,
} from "@/lib/routes";

// The sitemap is a projection of local constants, so keeping it static avoids
// unnecessary server execution.
export const dynamic = "force-static";

const absolute = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

/**
 * Site URLs, one per page and language, each listing its three siblings.
 * `metadataBase` does not apply here: sitemap alternates must be absolute URLs
 * or crawlers ignore them.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const localized = ROUTES.flatMap((route) =>
    LOCALES.map((locale) => {
      const { canonical, languages } = alternatesFor(locale, route);

      return {
        url: absolute(canonical),
        alternates: {
          languages: Object.fromEntries(
            Object.entries(languages).map(([code, path]) => [
              code,
              absolute(path),
            ]),
          ),
        },
      };
    }),
  );

  // Budget advice exists only in French, so do not advertise nonexistent
  // localized alternates.
  const advice = [
    { url: absolute(ADVICE_INDEX_ROUTE) },
    ...GUIDES.map((guide) => ({
      url: absolute(`${ADVICE_INDEX_ROUTE}/${guide.slug}`),
      lastModified: guide.updatedAt,
    })),
    { url: absolute(CALCULATOR_ROUTE) },
  ];

  const trust = TRUST_ROUTES.map((route) => ({ url: absolute(route) }));

  // German advice exists only in German, so it has no alternates either. Its
  // slugs are independent from the French ones.
  const germanAdvice = DE_GUIDES.map((guide) => ({
    url: absolute(
      localizedPath("de", `${DE_ADVICE_SECTION_PATH}/${guide.slug}`),
    ),
    lastModified: guide.updatedAt,
  }));

  return [...localized, ...trust, ...advice, ...germanAdvice];
}
