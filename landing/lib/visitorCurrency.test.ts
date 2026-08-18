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

// Depuis que la landing existe en quatre langues, un visiteur allemand ou
// italien n'est plus rangé en francs par défaut faute d'être français.
test("un visiteur allemand ou italien lit des euros", () => {
  assert.equal(currencyFor("Europe/Berlin", "de-DE,de"), "EUR");
  assert.equal(currencyFor("Europe/Vienna", "de-AT,de"), "EUR");
  assert.equal(currencyFor("Europe/Rome", "it-IT,it"), "EUR");
});

// La précédence suisse tient pour les trois langues nationales, pas seulement
// pour le français : c'est le `-CH` qui décide, pas la racine.
test("un navigateur suisse alémanique ou italophone reste en francs", () => {
  assert.equal(currencyFor("Europe/Zurich", "de-CH,de"), "CHF");
  assert.equal(currencyFor("Europe/Rome", "it-CH"), "CHF");
});

test("hors zone franco-suisse, le franc par défaut", () => {
  assert.equal(currencyFor("America/New_York", "en-US"), "CHF");
});
