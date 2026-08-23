import { i18n, translate } from "@/core/i18n/i18n";

import { amountFieldAccessibilityLabel } from "./amount-field";

it.each([
  ["fr", "Montant, en Franc suisse", "Montant, en Euro"],
  ["en", "Montant, in Swiss franc", "Montant, in Euro"],
  ["de", "Montant, in Schweizer Franken", "Montant, in Euro"],
  ["it", "Montant, in Franco svizzero", "Montant, in Euro"],
])("localizes real currencies for TalkBack in %s", (locale, chf, eur) => {
  i18n.locale = locale;
  expect(amountFieldAccessibilityLabel(translate, "Montant", "CHF")).toBe(chf);
  expect(amountFieldAccessibilityLabel(translate, "Montant", "EUR")).toBe(eur);
});
