import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const FR_JSON = "frontend/projects/webapp/public/i18n/fr.json";

const flatten = (node, prefix = "") =>
  Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value]] : flatten(value, path);
  });

const HOW_TO_WRITE_IT_INSTEAD = [
  "« transaction » nomme la table, pas ce que l'utilisateur lit. Écris plutôt :",
  "  · action ou titre  → un verbe          « Noter une dépense », « Modifier »",
  "  · message d'erreur → perds le sujet    « L'ajout a échoué — réessaie »",
  "  · collection       → au pluriel        « Mouvements »",
  "  · total face à Prévu → l'agrégat       « Réel »",
  "Les clés, elles, gardent le nom du domaine : seule la valeur affichée change.",
].join("\n");

test("aucune chaîne affichée par la webapp ne dit « transaction »", () => {
  const offenders = flatten(JSON.parse(read(FR_JSON)))
    .filter(([, value]) => /transaction/i.test(value))
    .map(([path, value]) => `  ${path} = ${value}`);

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${FR_JSON} :\n${offenders.join("\n")}`,
  );
});
