"use client";

import { useSyncExternalStore } from "react";
import type { LandingCurrency } from "./amount";

// La devise dépend du visiteur, donc elle ne peut pas être résolue au prérendu :
// le HTML statique part toujours en CHF et bascule à l'hydratation. Le hook vit
// ici, et non dans le Hero, parce que trois sections affichent des montants et
// qu'une seconde détection locale finirait par diverger de la première.
const SWISS_TIMEZONE = "Europe/Zurich";
const FRENCH_TIMEZONE = "Europe/Paris";

// La Suisse l'emporte sur la France, et pas l'inverse : un `fr-CH` sur un fuseau
// parisien est un Suisse en déplacement, alors qu'un fuseau suisse sur un
// navigateur français est plus souvent un Français installé en Suisse — les deux
// se lisent en francs. L'euro demande donc les deux signaux d'accord.
export function currencyFor(
  timezone: string,
  languages: string,
): LandingCurrency {
  const isSwiss = timezone === SWISS_TIMEZONE || /-CH\b/i.test(languages);
  const isFrench =
    timezone === FRENCH_TIMEZONE || /\bfr(-FR)?\b/i.test(languages);
  return !isSwiss && isFrench ? "EUR" : "CHF";
}

function subscribeToNothing(): () => void {
  return () => undefined;
}

// `useSyncExternalStore` appelle `getSnapshot` à chaque rendu de chaque îlot, et
// la page en compte une vingtaine. Le résultat ne peut pas changer sans
// rechargement, donc il est calculé une fois.
let detectedCurrency: LandingCurrency | undefined;

function getVisitorCurrency(): LandingCurrency {
  detectedCurrency ??= currencyFor(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    (navigator.languages ?? [navigator.language]).join(","),
  );
  return detectedCurrency;
}

function getPrerenderedCurrency(): LandingCurrency {
  return "CHF";
}

export function useVisitorCurrency(): LandingCurrency {
  return useSyncExternalStore(
    subscribeToNothing,
    getVisitorCurrency,
    getPrerenderedCurrency,
  );
}
