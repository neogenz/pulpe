import assert from "node:assert/strict";
import { describe, it } from "node:test";
// Nommés `…Dict` : `it` importé nu masquerait le `it` de `node:test`, et la
// suite entière se chargerait sans exécuter un seul bloc.
import frDict from "./dictionaries/fr";
import enDict from "./dictionaries/en";
import deDict from "./dictionaries/de";
import itDict from "./dictionaries/it";

// Le typage couvre déjà les clés manquantes : `Dictionary` est le type de `fr`,
// donc une traduction incomplète ne compile pas. Ce qu'il ne voit pas, c'est une
// clé en trop, une chaîne vide, un tableau plus court, ou une espace insécable
// française recopiée dans une langue qui n'en met pas. C'est ce que ce fichier
// vérifie, sur les trois traductions à la fois.
const TRANSLATIONS = {
  en: enDict,
  de: deDict,
  it: itDict,
} as const;

/** Chaque feuille du catalogue, par chemin pointé, index de tableau compris. */
function leaves(value: unknown, path = ""): Map<string, string> {
  const found = new Map<string, string>();

  if (typeof value === "string") {
    found.set(path, value);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      for (const [key, leaf] of leaves(item, `${path}[${index}]`)) {
        found.set(key, leaf);
      }
    });
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const child = path ? `${path}.${key}` : key;
      for (const [leafPath, leaf] of leaves(item, child)) {
        found.set(leafPath, leaf);
      }
    }
  }
  return found;
}

const frLeaves = leaves(frDict);

describe("landing dictionaries", () => {
  it("gives every language exactly the French shape", () => {
    // Les chemins portent l'index des tableaux : une langue qui listerait onze
    // initiales de mois, ou un quatrième témoignage, échoue ici.
    for (const [code, translation] of Object.entries(TRANSLATIONS)) {
      assert.deepEqual(
        [...leaves(translation).keys()].sort(),
        [...frLeaves.keys()].sort(),
        `${code} n'a pas la même forme que le catalogue français`,
      );
    }
  });

  it("leaves no empty string in any language", () => {
    for (const [code, catalog] of Object.entries({
      fr: frDict,
      ...TRANSLATIONS,
    })) {
      for (const [path, value] of leaves(catalog)) {
        assert.ok(value.trim().length > 0, `${code} : « ${path} » est vide`);
      }
    }
  });

  it("keeps French typography out of the other languages", () => {
    // L'insécable fine U+202F devant `?` et l'insécable pleine U+00A0 sont des
    // règles de composition françaises. Recopiées telles quelles, elles font
    // apparaître une espace parasite dans une phrase anglaise ou allemande.
    for (const [code, translation] of Object.entries(TRANSLATIONS)) {
      for (const [path, value] of leaves(translation)) {
        assert.doesNotMatch(
          value,
          /[  ]/,
          `${code} : « ${path} » porte une insécable française`,
        );
      }
    }
  });

  it("holds text, not markup", () => {
    // Le catalogue est rendu comme du texte : une entité HTML héritée du
    // balisage d'origine s'afficherait telle quelle, `&apos;` compris.
    for (const [code, catalog] of Object.entries({
      fr: frDict,
      ...TRANSLATIONS,
    })) {
      for (const [path, value] of leaves(catalog)) {
        assert.doesNotMatch(
          value,
          /&(?:[a-z]+|#\d+);|<\/?[a-z]/i,
          `${code} : « ${path} » contient du balisage`,
        );
      }
    }
  });
});
