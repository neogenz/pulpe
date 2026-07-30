import assert from "node:assert/strict";
import { test } from "node:test";
import { currencyFor } from "./visitorCurrency";

// Le défaut d'origine : la page servait des francs suisses à un visiteur
// français. Deux signaux entrent dans la décision, le fuseau et les langues, et
// c'est leur désaccord qui casse — d'où les cas croisés plutôt qu'un cas par
// pays.
test("un visiteur français lit des euros", () => {
  assert.equal(currencyFor("Europe/Paris", "fr-FR,fr"), "EUR");
  assert.equal(currencyFor("Europe/Brussels", "fr-BE,fr,nl"), "EUR");
});

test("un visiteur suisse lit des francs", () => {
  assert.equal(currencyFor("Europe/Zurich", "fr-CH,fr,de-CH"), "CHF");
});

// La précédence voulue : le franc l'emporte dès qu'un des deux signaux est
// suisse. Sans le `!isSwiss`, ce cas basculerait en euros et un Suisse de
// passage à Paris verrait sa page changer de devise.
test("un navigateur suisse sur un fuseau français reste en francs", () => {
  assert.equal(currencyFor("Europe/Paris", "fr-CH"), "CHF");
});

test("hors zone franco-suisse, le franc par défaut", () => {
  assert.equal(currencyFor("America/New_York", "en-US"), "CHF");
});
