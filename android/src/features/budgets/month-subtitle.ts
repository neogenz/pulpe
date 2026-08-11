/**
 * The one line under a month's name on the budget list. Two sets, chosen on
 * whether the month lands in the black — a mirror of `Formatters.monthSubtitle`,
 * copy included, so the same month reads the same on both phones.
 */
const POSITIVE_SUBTITLES: Record<number, string> = {
  1: "Nouveau départ, nouvelles ambitions",
  2: "Court mais décisif",
  3: "Le printemps des bonnes habitudes",
  4: "Tes finances prennent forme",
  5: "Le beau temps sur tes comptes",
  6: "Mi-parcours — tu tiens le cap",
  7: "Profite, ton budget suit",
  8: "L'été file, ton budget tient",
  9: "La rentrée, un nouveau souffle",
  10: "L'automne des bons choix",
  11: "Bientôt le bilan — tu gères",
  12: "Dernière ligne droite",
};

const NEGATIVE_SUBTITLES: Record<number, string> = {
  1: "Janvier se rattrape vite",
  2: "Petit mois, petit ajustement",
  3: "Tu peux encore corriger le tir",
  4: "Rien d'irréversible — ajuste",
  5: "Un écart, pas une tendance",
  6: "Mi-parcours — tout se rééquilibre",
  7: "L'été coûte, c'est normal",
  8: "Ça arrive — septembre repart",
  9: "La rentrée remet les compteurs",
  10: "Encore le temps de corriger",
  11: "Presque fini — tiens bon",
  12: "On boucle, on ajuste",
};

export function monthSubtitle(month: number, isPositive: boolean): string {
  const subtitles = isPositive ? POSITIVE_SUBTITLES : NEGATIVE_SUBTITLES;
  return subtitles[month] ?? "";
}
