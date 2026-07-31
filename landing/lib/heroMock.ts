// Le mois de démonstration du hero. Il vit ici plutôt que dans `HeroDashboard`
// parce qu'une seconde surface le redessine à l'identique : `scripts/generate-og-image.ts`
// compose l'aperçu social sous `tsx`, hors de Next, où importer le composant
// ferait entrer `next/image` que rien ne résout en dehors du bundler. Quand les
// deux portaient chacun leurs chiffres, l'aperçu écrivait `1 200 CHF` là où la
// page rendait `1’200 CHF`.
export const HERO_AVAILABLE = 926;
export const HERO_SPENT = 3374;
export const HERO_BUDGET = 4300;

// La part remplie de la barre, arrondie ici une seule fois : la page l'anime et
// l'aperçu la fige, mais aucun des deux ne doit refaire la division de tête.
export const HERO_SPENT_PERCENT = Math.round((HERO_SPENT / HERO_BUDGET) * 100);

// `ticks` est la ligne qui se coche pendant l'animation de la page. L'aperçu
// social est une image fixe : il la montre déjà cochée, donc tout ce qui n'est
// pas `unchecked` y est rendu coché.
export const HERO_PREVISIONS = [
  { label: "Loyer", amount: 1200, state: "checked" },
  { label: "Assurance", amount: 25, state: "ticks" },
  { label: "Électricité", amount: 85, state: "unchecked" },
] as const;
