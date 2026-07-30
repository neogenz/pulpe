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
  // Le montant sort nu par défaut : dans une légende ou sous une barre, la
  // devise est déjà portée par la ligne au-dessus et ne se répète pas.
  showUnit?: boolean;
  // Le style de la seule unité, quand elle mérite une taille propre — un payoff
  // la veut plus petite que son montant. Sans effet si l'unité reste masquée.
  unitClassName?: string;
}

export function Amount({
  value,
  className = "",
  showUnit = false,
  unitClassName,
}: AmountProps) {
  const currency = useVisitorCurrency();
  return (
    <span className={`tabular-nums ${className}`}>
      {formatAmount(value, currency)}
      {showUnit ? (
        <span className={unitClassName ? `ml-1 ${unitClassName}` : "ml-1"}>
          {currencyUnit(currency)}
        </span>
      ) : null}
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
