"use client";

import { useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { LOCALE_BANNER, matchLocale, type Locale } from "@/lib/i18n";
import { localizedPath, type Route } from "@/lib/routes";

const ANSWERED_KEY = "pulpe-language-banner-answered";

// La réponse du visiteur vit hors de React : elle est déjà écrite quand le
// composant monte. En faire un état lu depuis un effet ferait rendre le bandeau
// une image avant de le retirer, à chaque page.
const listeners = new Set<() => void>();

// Navigation privée ou stockage refusé : la réponse ne franchit pas la page,
// mais elle doit au moins fermer le bandeau ici.
let answeredThisPage = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isAnswered() {
  if (answeredThisPage) return true;
  try {
    return window.localStorage.getItem(ANSWERED_KEY) !== null;
  } catch {
    return false;
  }
}

function answer() {
  answeredThisPage = true;
  try {
    window.localStorage.setItem(ANSWERED_KEY, "1");
  } catch {
    // Voir `answeredThisPage`.
  }
  for (const listener of listeners) listener();
}

/**
 * Propose la version correspondant à la langue du navigateur, sans jamais
 * rediriger. Un export statique ne peut pas distinguer un visiteur qui a choisi
 * sa langue à la main de celui qui arrive pour la première fois : rediriger
 * l'enfermerait dans une langue qu'il vient peut-être de quitter — et Google
 * demande de l'éviter.
 *
 * Le HTML prérendu est le même pour tous les visiteurs, donc le bandeau n'y
 * figure pas : l'instantané serveur répond « déjà répondu ».
 */
export function LanguageBanner({
  locale,
  route,
}: {
  locale: Locale;
  route: Route;
}) {
  const answered = useSyncExternalStore(subscribe, isAnswered, () => true);
  if (answered) return null;

  const suggestion = matchLocale(window.navigator.language);
  if (!suggestion || suggestion === locale) return null;

  const banner = LOCALE_BANNER[suggestion];

  return (
    <div
      lang={suggestion}
      className="fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-3 bg-text px-4 py-2 text-sm text-white pt-[calc(0.5rem+env(safe-area-inset-top))]"
    >
      <p>{banner.message}</p>
      <a
        href={localizedPath(suggestion, route)}
        onClick={answer}
        className="rounded-md font-semibold underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {banner.action}
      </a>
      <button
        type="button"
        onClick={answer}
        aria-label={banner.dismiss}
        className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X aria-hidden="true" size={16} />
      </button>
    </div>
  );
}
