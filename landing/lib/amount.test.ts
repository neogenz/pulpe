import assert from "node:assert/strict";
import { test } from "node:test";
import { currencyUnit, formatAmount, formatMoney } from "./amount";

// Le défaut d'origine : la page écrivait le même montant de deux façons, `1'200`
// dans une section et `1 200` dans une autre, avec une espace ordinaire qui
// autorisait `1 200 CHF` à se couper en fin de ligne. Ces assertions portent sur
// les points de code exacts, parce que c'est là que la régression se produit et
// qu'aucun des trois séparateurs concernés n'est visible dans un diff.
test("le franc groupe avec l'apostrophe suisse et colle son unité", () => {
  assert.equal(formatMoney(1200, "CHF"), "1’200 CHF");
  assert.equal(formatMoney(2400, "CHF"), "2’400 CHF");
  assert.equal(formatAmount(3374, "CHF"), "3’374");
});

test("l'euro groupe avec l'espace fine insécable de fr-FR", () => {
  assert.equal(formatMoney(1200, "EUR"), "1 200 €");
  assert.equal(currencyUnit("EUR"), "€");
});

test("sous mille, aucun séparateur de milliers", () => {
  assert.equal(formatMoney(926, "CHF"), "926 CHF");
  assert.equal(formatAmount(300, "CHF"), "300");
});

// Les deux formes que la page portait avant : l'apostrophe droite U+0027 que
// l'ICU de Node produit pour de-CH, et l'espace ordinaire U+0020 qui autorise la
// coupure. Aucune ne doit ressortir du helper, pour aucune devise.
test("ni apostrophe droite ni espace sécable dans un montant", () => {
  for (const currency of ["CHF", "EUR"] as const) {
    const formatted = formatMoney(1200, currency);
    assert.doesNotMatch(formatted, /'/, `U+0027 dans ${formatted}`);
    assert.doesNotMatch(formatted, / /, `U+0020 dans ${formatted}`);
  }
});
