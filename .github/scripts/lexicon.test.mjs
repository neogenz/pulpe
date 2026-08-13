import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const I18N_ROOT = "frontend/projects/webapp/public/i18n";
const SWIFT_ROOT = "ios/Pulpe";

// Le mot est banni parce que Pulpe n'a aucun lien bancaire — c'est une règle
// produit, pas une règle de français. Chaque langue doit donc déclarer le sien :
// une liste unique ferait échouer en.json dès le premier jour, puisque
// « transaction » y est le mot anglais juste.
const BANNED_WORD_BY_LANG = {
  fr: /transaction/i,
  en: /transaction/i,
  de: /transaktion/i,
  it: /transazione/i,
};

const flatten = (node, prefix = "") =>
  Object.entries(node).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [[path, value]] : flatten(value, path);
  });

const HOW_TO_WRITE_IT_INSTEAD = [
  "« transaction » nomme la table, pas ce que l'utilisateur lit. Écris plutôt :",
  "  · action ou titre  → un verbe          « Noter une dépense », « Modifier »",
  "  · message d'erreur → perds le sujet    « L'ajout a échoué — réessaie »",
  "  · collection       → au pluriel        « Mouvements », Activity, Bewegungen, Movimenti",
  "  · total face à Prévu → l'agrégat       « Réel », Actual, Tatsächlich, Effettivo",
  "Les clés, elles, gardent le nom du domaine : seule la valeur affichée change.",
  "La traduction arrêtée de chaque terme vit dans docs/I18N.md.",
].join("\n");

const catalogs = () =>
  readdirSync(new URL(`../../${I18N_ROOT}`, import.meta.url))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ file, lang: file.replace(/\.json$/, "") }));

test("aucune chaîne affichée par la webapp ne dit « transaction »", () => {
  const found = catalogs();
  assert.notEqual(found.length, 0, `Aucun catalogue lu dans ${I18N_ROOT}/.`);

  const offenders = found.flatMap(({ file, lang }) => {
    const banned = BANNED_WORD_BY_LANG[lang];
    assert.ok(
      banned,
      `${I18N_ROOT}/${file} : aucun mot interdit déclaré pour « ${lang} ». ` +
        "Ajoute-le à BANNED_WORD_BY_LANG, sinon ce garde reste vert sans rien prouver.",
    );

    return flatten(JSON.parse(read(`${I18N_ROOT}/${file}`)))
      .filter(([, value]) => banned.test(value))
      .map(([path, value]) => `  ${file} → ${path} = ${value}`);
  });

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${I18N_ROOT}/ :\n${offenders.join("\n")}`,
  );
});

// Le vouvoiement se réintroduit par reformulation, exactement comme le mot
// interdit : rien ne casse, et il faut lire la langue pour le voir. En allemand
// la forme de politesse ne se distingue du pronom « ils » que par la majuscule,
// donc c'est la majuscule qu'on interdit — une phrase qui commence par `Sie`
// reste ambiguë même quand l'auteur voulait « ils », et la lever demande de
// déplacer le pronom vers le milieu de la phrase.
const FORMAL_ADDRESS_BY_LANG = {
  de: /(?<![A-Za-zÄÖÜäöüß])(Sie|Ihre?[mnrs]?|Ihnen)(?![a-zäöüß])/,
  it: /(?<![A-Za-zÀ-ÿ])(Lei|Suoi?|Sua|Sue|Vostr[aeio])(?![a-zà-ÿ])/,
};

test("aucune chaîne affichée par la webapp ne vouvoie", () => {
  const offenders = catalogs().flatMap(({ file, lang }) => {
    const formal = FORMAL_ADDRESS_BY_LANG[lang];
    if (!formal) return [];

    return flatten(JSON.parse(read(`${I18N_ROOT}/${file}`)))
      .filter(([, value]) => formal.test(value))
      .map(([path, value]) => `  ${file} → ${path} = ${value}`);
  });

  assert.equal(
    offenders.length,
    0,
    "Pulpe tutoie dans les quatre langues (docs/I18N.md).\n" +
      `Dans ${I18N_ROOT}/ :\n${offenders.join("\n")}`,
  );
});

// Le catalogue iOS prend le littéral français pour clé : le français vit donc
// toujours dans les sources, et aucun compilateur ne signalera un oubli. Ce
// garde lit les sources comme du texte, ce qui lui suffit pour tenir les deux
// clients sur le même mot. Les traductions, elles, vivent dans le catalogue et
// sont lues plus bas.
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

// Un commentaire décrit le code, il ne s'affiche pas — et un `"""` qu'il cite
// n'ouvre aucun littéral. Le test passe donc avant tout le reste, sauf à
// l'intérieur d'un littéral, où une ligne commençant par `//` est du texte.
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

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
 *
 * Les deux états se referment avant la fin du fichier, et la fonction le
 * vérifie : un décalage ne coûte pas un faux positif, il fait sauter tout le
 * reste du fichier en silence. Un garde qui lit moins qu'annoncé doit le dire.
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

    if (insideMultilineLiteral) {
      if (line.includes('"""')) {
        insideMultilineLiteral = false;
        return;
      }
      if (previewDepth === 0) flag(withoutInterpolations(line.trim()));
      return;
    }

    if (isComment(line)) return;

    if (line.includes('"""')) {
      insideMultilineLiteral = true;
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

    (line.match(/"(?:[^"\\]|\\.)*"/g) ?? []).map(displayedText).forEach(flag);
  });

  if (insideMultilineLiteral || previewDepth !== 0) {
    throw new Error(
      `${path} : le garde a perdu le fil (littéral ouvert : ${insideMultilineLiteral}, ` +
        `profondeur de #Preview : ${previewDepth}). Il a donc cessé de lire ce fichier ` +
        `avant la fin, et son silence ne prouve rien.`,
    );
  }

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

const IOS_CATALOG = "ios/Pulpe/Resources/Localizable.xcstrings";

/**
 * Toute valeur rendue par une localisation, quelle que soit sa profondeur.
 *
 * Une entrée porte soit un `stringUnit`, soit des `variations` — pluriel,
 * genre — imbriquées à profondeur libre. Ne lire que le premier cas rendrait le
 * garde muet sur les formes plurielles, sans le dire.
 */
const stringUnitValues = (node) => {
  if (node === null || typeof node !== "object") return [];
  if (typeof node.stringUnit?.value === "string")
    return [node.stringUnit.value];
  return Object.values(node).flatMap(stringUnitValues);
};

const iosTranslations = () =>
  Object.entries(JSON.parse(read(IOS_CATALOG)).strings).flatMap(
    ([key, entry]) =>
      Object.entries(entry.localizations ?? {}).flatMap(([lang, node]) =>
        stringUnitValues(node).map((value) => ({ key, lang, value })),
      ),
  );

test("aucune traduction du catalogue iOS ne dit « transaction »", () => {
  const translations = iosTranslations();
  assert.notEqual(
    translations.length,
    0,
    `Aucune traduction lue dans ${IOS_CATALOG}. Le garde ne prouverait rien.`,
  );

  const offenders = translations
    .filter(({ lang, value }) => BANNED_WORD_BY_LANG[lang]?.test(value))
    .map(({ key, lang, value }) => `  ${lang} → ${key} = ${value}`);

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${IOS_CATALOG} :\n${offenders.join("\n")}`,
  );
});

test("aucune traduction du catalogue iOS ne vouvoie", () => {
  const offenders = iosTranslations()
    .filter(({ lang, value }) => FORMAL_ADDRESS_BY_LANG[lang]?.test(value))
    .map(({ key, lang, value }) => `  ${lang} → ${key} = ${value}`);

  assert.equal(
    offenders.length,
    0,
    "Pulpe tutoie dans les quatre langues (docs/I18N.md).\n" +
      `Dans ${IOS_CATALOG} :\n${offenders.join("\n")}`,
  );
});
