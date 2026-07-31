// Le séparateur de milliers est écrit en dur plutôt que dérivé d'un
// `Intl.NumberFormat('de-CH')` : l'ICU de Node rend U+0027 (`1'200`) là où celui
// de Chrome rend U+2019 (`1’200`). La landing est un export statique dont le
// hero re-rend côté client après détection de la devise, donc passer par Intl
// donnerait deux textes différents pour le même montant entre le HTML prérendu
// et l'hydratation — et un désaccord avec l'app, qui rend U+2019 partout.
//
// fr-FR est cohérent entre les deux moteurs (U+202F, déjà insécable), mais il
// est fixé ici aussi pour que les deux devises se lisent au même endroit. Les
// séparateurs invisibles restent en échappement : un passage de formatage qui
// les normaliserait en espace ordinaire casserait l'insécabilité sans laisser
// de trace dans le diff.
const CURRENCIES = {
  CHF: { group: "’", unit: "CHF" },
  EUR: { group: " ", unit: "€" },
} as const;

const NON_BREAKING_SPACE = " ";

export type LandingCurrency = keyof typeof CURRENCIES;

export function currencyUnit(currency: LandingCurrency): string {
  return CURRENCIES[currency].unit;
}

// La landing n'affiche que des agrégats — un disponible, un total, une part
// mensuelle — jamais une ligne de budget au centime, donc pas de décimales.
//
// La devise n'a pas de valeur par défaut : un défaut ne peut se tromper que dans
// un sens, celui d'afficher des francs à un visiteur français, et c'est le bug
// que ce module existe pour tuer. TypeScript est le seul garde-fou qui ne
// s'oublie pas au moment d'ajouter un montant.
export function formatAmount(value: number, currency: LandingCurrency): string {
  return String(Math.round(value)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    CURRENCIES[currency].group,
  );
}

// L'espace insécable garde `1’200 CHF` d'un seul tenant : avec une espace
// ordinaire, une fin de ligne peut laisser `1’200` seul et renvoyer `CHF` à la
// ligne suivante.
export function formatMoney(value: number, currency: LandingCurrency): string {
  return `${formatAmount(value, currency)}${NON_BREAKING_SPACE}${CURRENCIES[currency].unit}`;
}
