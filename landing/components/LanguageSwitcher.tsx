import type { Dictionary } from "@/content/dictionary";
import { LOCALES, LOCALE_NATIVE_NAME, type Locale } from "@/lib/i18n";
import { localizedPath, type Route } from "@/lib/routes";

/**
 * Des ancres nues, et non des `next/link` : les quatre langues vivent sous deux
 * root layouts distincts, et traverser cette frontière force de toute façon un
 * chargement de page complet. C'est ce qu'il faut ici — `<html lang>` change.
 *
 * Le sélecteur mène à la même page dans l'autre langue, jamais à l'accueil :
 * atterrir ailleurs que là où on était est la façon la plus sûre de perdre un
 * lecteur qui voulait juste relire le paragraphe qu'il avait sous les yeux.
 */
export function LanguageSwitcher({
  dict,
  locale,
  route,
}: {
  dict: Dictionary["language"];
  locale: Locale;
  route: Route;
}) {
  return (
    <nav
      aria-label={dict.switcherLabel}
      className="flex flex-wrap gap-x-4 gap-y-1"
    >
      {LOCALES.map((code) => {
        const isCurrent = code === locale;
        return (
          <a
            key={code}
            href={localizedPath(code, route)}
            hrefLang={code}
            aria-current={isCurrent ? "true" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none lg:items-end ${
              isCurrent
                ? "font-semibold text-text underline decoration-primary decoration-2 underline-offset-4"
                : "font-medium text-text-secondary hover:text-primary"
            }`}
          >
            {LOCALE_NATIVE_NAME[code]}
          </a>
        );
      })}
    </nav>
  );
}
