import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n";
import { alternatesFor, ROUTES, SITE_URL } from "@/lib/routes";

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
  return ROUTES.flatMap((route) =>
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
}
