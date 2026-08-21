import { i18n, translate } from "@/core/i18n/i18n";

import { amountFieldAccessibilityLabel } from "./amount-field";

it("localizes the amount field for TalkBack", () => {
  i18n.locale = "fr";
  expect(
    amountFieldAccessibilityLabel(translate, "Revenu", "franc suisse"),
  ).toBe("Revenu, en franc suisse");

  i18n.locale = "en";
  expect(
    amountFieldAccessibilityLabel(translate, "Income", "Swiss franc"),
  ).toBe("Income, in Swiss franc");
});
