"use client";

import { useSyncExternalStore } from "react";
import type { LandingCurrency } from "./amount";

// La devise dépend du visiteur, donc elle ne peut pas être résolue au prérendu :
// le HTML statique part toujours en CHF et bascule à l'hydratation. Le hook vit
// ici, et non dans le Hero, parce que trois sections affichent des montants et
// qu'une seconde détection locale finirait par diverger de la première.
const SWISS_TIMEZONE = "Europe/Zurich";

// Les fuseaux des pays de la zone euro auxquels Pulpe parle depuis qu'il existe
// en quatre langues. Avant, seul Paris comptait, et un visiteur allemand ou
// italien recevait des francs suisses pour la seule raison qu'il n'était pas
// français.
const EURO_TIMEZONES = new Set([
  "Europe/Paris",
  "Europe/Brussels",
  "Europe/Luxembourg",
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Rome",
]);

// La racine de langue suffit : un navigateur suisse porte toujours sa région
// (`de-CH`, `fr-CH`, `it-CH`), et c'est la précédence suisse ci-dessous qui
// tranche ce cas. La détection reste fondée sur le fuseau et la langue du
// visiteur, jamais sur la langue de la page : l'argent et la langue sont deux
// choses différentes, et lire l'allemand ne fait pas payer en euros.
const EURO_LANGUAGE = /\b(?:fr|de|it)\b/i;

// La Suisse l'emporte sur la zone euro, et pas l'inverse : un `fr-CH` sur un
// fuseau parisien est un Suisse en déplacement, alors qu'un fuseau suisse sur un
// navigateur français est plus souvent un Français installé en Suisse — les deux
// se lisent en francs. L'euro demande donc l'absence de tout signal suisse.
export function currencyFor(
  timezone: string,
  languages: string,
): LandingCurrency {
  const isSwiss = timezone === SWISS_TIMEZONE || /-CH\b/i.test(languages);
  const isEurozone =
    EURO_TIMEZONES.has(timezone) || EURO_LANGUAGE.test(languages);
  return !isSwiss && isEurozone ? "EUR" : "CHF";
}

function subscribeToNothing(): () => void {
  return () => undefined;
}

// `useSyncExternalStore` appelle `getSnapshot` à chaque rendu de chaque îlot, et
// la page en compte une vingtaine. Le résultat ne peut pas changer sans
// rechargement, donc il est calculé une fois.
let detectedCurrency: LandingCurrency | undefined;

function visitorCurrency(): LandingCurrency {
  detectedCurrency ??= currencyFor(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    (navigator.languages ?? [navigator.language]).join(","),
  );
  return detectedCurrency;
}

function prerenderedCurrency(): LandingCurrency {
  return "CHF";
}

export function useVisitorCurrency(): LandingCurrency {
  return useSyncExternalStore(
    subscribeToNothing,
    visitorCurrency,
    prerenderedCurrency,
  );
}
