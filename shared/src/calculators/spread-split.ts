/**
 * @fileoverview SPREAD SPLIT (PUL-17 v1.1) — lissage TOTAL-PRÉSERVANT.
 *
 * Répartit un montant total en N parts EN CENTIMES de sorte que Σ parts === total
 * exactement. Le reste d'arrondi (`total*100 mod N` centimes) est distribué un
 * centime par part sur les R PREMIÈRES parts (le mois courant M0 d'abord) —
 * jamais la dernière — pour que la somme soit exacte ET que M0 ne soit jamais
 * artificiellement allégé (honnêteté : on ne cache pas le reste sur un mois
 * lointain).
 *
 * Fonction pure, source de vérité UNIQUE utilisée côté backend (écriture
 * autoritaire) ET côté frontend (aperçu live) → l'aperçu égale toujours ce qui
 * est persisté.
 */

const CENTS_PER_UNIT = 100;

/**
 * Splits `total` into `partCount` amounts whose sum equals `total` to the cent.
 * Remainder cents land on the first parts (index 0 = M0 = current month first).
 *
 * @throws if `total` is not a positive finite number, or `partCount` < 1.
 */
export function splitTotalPreserving(
  total: number,
  partCount: number,
): number[] {
  if (!Number.isFinite(total) || total <= 0) {
    throw new Error('splitTotalPreserving: total must be a positive number');
  }
  if (!Number.isInteger(partCount) || partCount < 1) {
    throw new Error('splitTotalPreserving: partCount must be an integer >= 1');
  }

  const totalCents = Math.round(total * CENTS_PER_UNIT);
  const baseCents = Math.floor(totalCents / partCount);
  const remainderCents = totalCents - baseCents * partCount;

  return Array.from(
    { length: partCount },
    (_, index) =>
      (baseCents + (index < remainderCents ? 1 : 0)) / CENTS_PER_UNIT,
  );
}
