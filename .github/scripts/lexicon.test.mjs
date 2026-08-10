import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const FR_JSON = "frontend/projects/webapp/public/i18n/fr.json";
const SWIFT_ROOT = "ios/Pulpe";

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

// iOS n'a pas de catalogue de chaînes : la copie vit en dur dans les vues, et
// aucun compilateur ne signalera un oubli. Ce garde lit les sources comme du
// texte, ce qui lui suffit pour tenir les deux clients sur le même mot.
//
// Une note de version déjà publiée raconte ce que la version disait à l'époque.
// La réécrire falsifierait l'historique, donc elle sort du périmètre.
const NOT_APP_COPY = new Set(["Shared/Components/WhatsNewSheet.swift"]);

/**
 * Ce que l'utilisateur lit, par opposition à ce que la machine lit.
 *
 * Les chaînes techniques se reconnaissent à leur forme, pas à leur emplacement.
 * Deux cas, selon qu'il y a une espace ou non :
 *
 *   · avec espace — c'est une phrase, sauf si un `_` ou un `/` la traverse ;
 *     seule une clé composée ou un chemin en porte au milieu de mots séparés.
 *   · sans espace — c'est un mot nu, donc de la copie, SAUF s'il porte un
 *     séparateur (`_`, `-`, `/`, un chiffre) ou une casse interne : ces
 *     formes-là nomment une clé d'analytics, un identifiant de test, un chemin
 *     d'API ou un code d'erreur.
 *
 * Ce second cas est ce qui rattrape un `Text("Transactions")` — un libellé
 * tient souvent en un seul mot, et l'exempter rendait le garde muet sur la
 * forme la plus courante d'une étiquette.
 *
 * Les interpolations disparaissent d'abord : `\(transaction.name)` est un
 * identifiant Swift qui traverse la chaîne, pas un mot affiché.
 */
const displayedText = (literal) =>
  literal.slice(1, -1).replaceAll(/\\\([^)]*\)/g, "");

const isBareWord = (text) =>
  /^[A-Za-zÀ-ÿ]+$/.test(text) && !/[a-z][A-Z]/.test(text);

const isDisplayedProse = (text) =>
  text.includes(" ") ? !/[_/]/.test(text) : isBareWord(text);

// Trié : `readdirSync` rend l'ordre du système de fichiers, qui n'est pas le
// même sur APFS en local et sur ext4 en CI. La liste des coupables sert à être
// lue en cas d'échec — sans tri, deux sorties ne se comparent pas.
const swiftSources = () =>
  readdirSync(new URL(`../../${SWIFT_ROOT}`, import.meta.url), {
    recursive: true,
  })
    .filter((path) => path.endsWith(".swift") && !NOT_APP_COPY.has(path))
    .sort();

test("aucune chaîne affichée par l'app iOS ne dit « transaction »", () => {
  const offenders = swiftSources().flatMap((path) =>
    read(`${SWIFT_ROOT}/${path}`)
      .split("\n")
      .flatMap((line, index) => {
        // Un commentaire décrit le code, il ne s'affiche pas ; un `#Preview`
        // nomme une vignette du canvas Xcode, que l'app n'embarque pas.
        if (/^\s*(\/\/|\*|\/\*|#Preview\()/.test(line)) return [];
        return (line.match(/"(?:[^"\\]|\\.)*"/g) ?? [])
          .map(displayedText)
          .filter((text) => /transaction/i.test(text) && isDisplayedProse(text))
          .map((text) => `  ${path}:${index + 1} = ${text}`);
      }),
  );

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${SWIFT_ROOT}/ :\n${offenders.join("\n")}`,
  );
});
