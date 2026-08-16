import type { MetadataRoute } from "next";
import { GUIDES } from "@/components/guides/guides";
import { LOCALES } from "@/lib/i18n";
import {
  ADVICE_INDEX_ROUTE,
  alternatesFor,
  ROUTES,
  SITE_URL,
} from "@/lib/routes";

// Sans cette ligne, le build meurt sur `route "/sitemap.xml" with "output:
// export"` : Next traite le sitemap comme une route dynamique par défaut.
export const dynamic = "force-static";

const absolute = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

/**
 * Les 16 URLs du site, une par page et par langue, chacune listant ses trois
 * sœurs. `metadataBase` ne s'applique pas ici : les alternates d'un sitemap
 * doivent être des URLs absolues, sans quoi les robots les ignorent.
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

  // Les conseils budget n'existent qu'en français : aucun `alternates` à
  // déclarer, sous peine d'annoncer des versions qui n'existent pas.
  const advice = [
    { url: absolute(ADVICE_INDEX_ROUTE) },
    ...GUIDES.map((guide) => ({
      url: absolute(`${ADVICE_INDEX_ROUTE}/${guide.slug}`),
      lastModified: guide.updatedAt,
    })),
  ];

  return [...localized, ...advice];
}
