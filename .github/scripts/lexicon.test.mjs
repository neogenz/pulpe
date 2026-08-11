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
// Aucun fichier n'en est exempté. Une note de version déjà publiée est le seul
// texte que le garde ne doit pas régenter, et elle ne vit pas dans une vue :
// `WhatsNewService` la porte, `WhatsNewStore` la sert. Ce qu'une vue en montre
// dans un `#Preview` est une vignette de canvas, traitée comme telle plus bas.

/** `\(transaction.name)` est un identifiant Swift qui traverse la chaîne, pas un mot affiché. */
const withoutInterpolations = (text) => text.replaceAll(/\\\([^)]*\)/g, "");

const displayedText = (literal) => withoutInterpolations(literal.slice(1, -1));

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
 */
const isBareWord = (text) =>
  /^[A-Za-zÀ-ÿ]+$/.test(text) && !/[a-z][A-Z]/.test(text);

const isDisplayedProse = (text) =>
  text.includes(" ") ? !/[_/]/.test(text) : isBareWord(text);

// Les accolades se comptent sur la ligne débarrassée de ses littéraux : une
// chaîne comme `"{ }"` fausserait sinon la profondeur du bloc.
const braceDelta = (line) => {
  const code = line.replaceAll(/"(?:[^"\\]|\\.)*"/g, "");
  return (code.match(/{/g) ?? []).length - (code.match(/}/g) ?? []).length;
};

/**
 * Un fichier se lit du haut vers le bas parce que deux constructions débordent
 * de leur ligne, et qu'un balayage ligne à ligne les manque toutes les deux :
 *
 *   · un littéral `"""` porte sa prose sur des lignes sans aucun guillemet, que
 *     l'appariement `"…"` ne voit pas. Swift impose ses délimiteurs seuls sur
 *     leur ligne, donc une ligne qui en porte un ne fait que basculer l'état, et
 *     les lignes intérieures passent telles quelles au filtre commun.
 *   · un `#Preview` nomme une vignette du canvas Xcode, que l'app n'embarque
 *     pas. C'est le bloc entier qui sort du périmètre, suivi à la profondeur
 *     d'accolades — n'en sauter que la ligne d'ouverture ne tenait pas la
 *     promesse et poussait à exempter des fichiers entiers à la place.
 */
const offendersIn = (path, source) => {
  const offenders = [];
  let insideMultilineLiteral = false;
  let previewDepth = 0;

  source.split("\n").forEach((line, index) => {
    const flag = (text) => {
      if (/transaction/i.test(text) && isDisplayedProse(text)) {
        offenders.push(`  ${path}:${index + 1} = ${text}`);
      }
    };

    if (line.includes('"""')) {
      insideMultilineLiteral = !insideMultilineLiteral;
      return;
    }
    if (insideMultilineLiteral) {
      if (previewDepth === 0) flag(withoutInterpolations(line.trim()));
      return;
    }

    if (previewDepth > 0) {
      previewDepth += braceDelta(line);
      return;
    }
    if (/^\s*#Preview\b/.test(line)) {
      previewDepth = braceDelta(line);
      return;
    }

    // Un commentaire décrit le code, il ne s'affiche pas.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;

    (line.match(/"(?:[^"\\]|\\.)*"/g) ?? []).map(displayedText).forEach(flag);
  });

  return offenders;
};

// Trié : `readdirSync` rend l'ordre du système de fichiers, qui n'est pas le
// même sur APFS en local et sur ext4 en CI. La liste des coupables sert à être
// lue en cas d'échec — sans tri, deux sorties ne se comparent pas.
const swiftSources = () =>
  readdirSync(new URL(`../../${SWIFT_ROOT}`, import.meta.url), {
    recursive: true,
  })
    .filter((path) => path.endsWith(".swift"))
    .sort();

test("aucune chaîne affichée par l'app iOS ne dit « transaction »", () => {
  const offenders = swiftSources().flatMap((path) =>
    offendersIn(path, read(`${SWIFT_ROOT}/${path}`)),
  );

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${SWIFT_ROOT}/ :\n${offenders.join("\n")}`,
  );
});
