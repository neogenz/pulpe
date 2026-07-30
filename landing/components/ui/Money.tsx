"use client";

import { currencyUnit, formatAmount, formatMoney } from "@/lib/amount";
import { useVisitorCurrency } from "@/lib/visitorCurrency";

// Trois îlots clients minuscules, plutôt que trois sections passées côté client.
// Les maquettes de HowItWorks et de Features sont le plus gros bloc de markup de
// la page ; seuls leurs nœuds de montant dépendent du visiteur, donc seuls
// ceux-là quittent le rendu serveur.

interface AmountProps {
  value: number;
  className?: string;
  // Sans `unitClassName`, le montant sort nu : dans une légende ou sous une
  // barre, la devise est déjà portée par la ligne au-dessus et ne se répète pas.
  unitClassName?: string;
}

export function Amount({ value, className = "", unitClassName }: AmountProps) {
  const currency = useVisitorCurrency();
  return (
    <span className={`tabular-nums ${className}`}>
      {formatAmount(value, currency)}
      {unitClassName === undefined ? null : (
        <span className={`ml-1 ${unitClassName}`}>
          {currencyUnit(currency)}
        </span>
      )}
    </span>
  );
}

// Le montant et sa devise dans un seul filet de texte, reliés par une espace
// insécable. Rendu sans balise propre pour ne rien ajouter au DOM des maquettes.
export function Money({ value }: { value: number }) {
  return <>{formatMoney(value, useVisitorCurrency())}</>;
}

// Pour les phrases où seule la devise varie — les figcaption sr-only gardent
// leurs chiffres nus, plus sûrs à la synthèse vocale que `1’400`.
export function CurrencyUnit() {
  return <>{currencyUnit(useVisitorCurrency())}</>;
}
