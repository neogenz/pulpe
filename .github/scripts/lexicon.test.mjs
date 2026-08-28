import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const I18N_ROOT = "frontend/projects/webapp/public/i18n";
const ANDROID_I18N_ROOT = "android/src/core/i18n/catalogs";
const SWIFT_ROOT = "ios/Pulpe";
const TSX_ROOT = "android/src";

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

const androidCatalogs = () =>
  readdirSync(new URL(`../../${ANDROID_I18N_ROOT}`, import.meta.url))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => ({ file, lang: file.replace(/\.json$/, "") }));

const androidTranslations = () =>
  androidCatalogs().flatMap(({ file, lang }) =>
    flatten(JSON.parse(read(`${ANDROID_I18N_ROOT}/${file}`))).map(
      ([key, value]) => ({ key, lang, value }),
    ),
  );

test("aucune traduction du catalogue Android ne dit « transaction »", () => {
  const translations = androidTranslations();
  assert.notEqual(
    translations.length,
    0,
    `Aucune traduction lue dans ${ANDROID_I18N_ROOT}. Le garde ne prouverait rien.`,
  );

  const offenders = translations
    .filter(({ lang, value }) => BANNED_WORD_BY_LANG[lang]?.test(value))
    .map(({ key, lang, value }) => `  ${lang} → ${key} = ${value}`);

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${ANDROID_I18N_ROOT} :\n${offenders.join("\n")}`,
  );
});

test("aucune traduction du catalogue Android ne vouvoie", () => {
  const offenders = androidTranslations()
    .filter(({ lang, value }) => FORMAL_ADDRESS_BY_LANG[lang]?.test(value))
    .map(({ key, lang, value }) => `  ${lang} → ${key} = ${value}`);

  assert.equal(
    offenders.length,
    0,
    "Pulpe tutoie dans les quatre langues (docs/I18N.md).\n" +
      `Dans ${ANDROID_I18N_ROOT} :\n${offenders.join("\n")}`,
  );
});

// Le mot désigne aussi un type et une demi-douzaine de fonctions dans les
// sources Android. `kind: "transaction"` et `useCreateTransaction` sont du
// domaine, et les régenter rendrait le garde inutilisable.
//
// Ce qui est lu est donc uniquement ce qui ne peut être que de l'affichage :
//
//   · un attribut JSX — `label="Mouvements"`, collé au `=`, ce qu'une
//     affectation TypeScript (`const x = "transaction"`) n'est jamais ;
//   · un nœud de texte JSX — `<Text>Mouvements</Text>`.
//
// Une valeur dans un objet, un argument de fonction ou un type n'est ni l'un ni
// l'autre, et sort du périmètre sans avoir à être exemptée nommément.
const JSX_ATTRIBUTE = /\b[a-zA-Z][a-zA-Z0-9]*="([^"]*)"/g;
const JSX_TEXT_NODE = />\s*([^<>{}\n]+?)\s*</g;

const tsxOffendersIn = (path, source) => {
  const offenders = [];

  source.split("\n").forEach((line, index) => {
    if (isComment(line)) return;

    const displayed = [
      ...[...line.matchAll(JSX_ATTRIBUTE)].map(([, value]) => value),
      ...[...line.matchAll(JSX_TEXT_NODE)].map(([, value]) => value),
    ];

    for (const text of displayed) {
      if (/transaction/i.test(text) && isDisplayedProse(text)) {
        offenders.push(`  ${path}:${index + 1} = ${text}`);
      }
    }
  });

  return offenders;
};

const tsxSources = () =>
  readdirSync(new URL(`../../${TSX_ROOT}`, import.meta.url), {
    recursive: true,
  })
    .filter((path) => path.endsWith(".tsx"))
    .sort();

test("aucune chaîne affichée par l'app Android ne dit « transaction »", () => {
  const offenders = tsxSources().flatMap((path) =>
    tsxOffendersIn(path, read(`${TSX_ROOT}/${path}`)),
  );

  assert.equal(
    offenders.length,
    0,
    `${HOW_TO_WRITE_IT_INSTEAD}\n\nDans ${TSX_ROOT}/ :\n${offenders.join("\n")}`,
  );
});

const IOS_CATALOG = "ios/Pulpe/Resources/Localizable.xcstrings";

/**
 * Toute valeur rendue par une localisation, quelle que soit sa profondeur.
 *
 * Une entrée porte soit un `stringUnit`, soit des `variations` — pluriel,
 * genre — imbriquées à profondeur libre. Ne lire que le premier cas rendrait le
 * garde muet sur les formes plurielles, sans le dire.
 *
 * Une localisation à `substitutions` porte les deux : son `stringUnit` n'est
 * que le gabarit `%#@nom@`, et les phrases que l'utilisateur lit vivent sous
 * les variations de chaque substitution. S'arrêter au gabarit les cachait à
 * tous les gardes.
 */
const stringUnits = (node) => {
  if (node === null || typeof node !== "object") return [];
  const own =
    typeof node.stringUnit?.value === "string" ? [node.stringUnit] : [];
  const below =
    own.length === 0
      ? Object.values(node)
      : Object.values(node.substitutions ?? {});
  return [...own, ...below.flatMap(stringUnits)];
};

const stringUnitValues = (node) => stringUnits(node).map(({ value }) => value);

const iosTranslations = () =>
  Object.entries(JSON.parse(read(IOS_CATALOG)).strings).flatMap(
    ([key, entry]) =>
      Object.entries(entry.localizations ?? {}).flatMap(([lang, node]) =>
        stringUnitValues(node).map((value) => ({ key, lang, value })),
      ),
  );

test("chaque clé traduisible iOS est complète en allemand, anglais et italien", () => {
  const catalog = JSON.parse(read(IOS_CATALOG));
  const translatedLocales = ["de", "en", "it"];
  const offenders = Object.entries(catalog.strings).flatMap(([key, entry]) => {
    if (entry.shouldTranslate === false) return [];
    return translatedLocales.flatMap((lang) => {
      const units = stringUnits(entry.localizations?.[lang]);
      if (units.length === 0)
        return [`  ${lang} → ${key} : traduction absente`];
      return units
        .filter(({ state }) => state !== "translated")
        .map(({ state }) => `  ${lang} → ${key} : état ${state ?? "absent"}`);
    });
  });

  assert.equal(
    offenders.length,
    0,
    `Toutes les clés traduisibles de ${IOS_CATALOG} doivent être traduites.\n` +
      offenders.join("\n"),
  );
});

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

// `%@` là où l'appelant passe un `Int` est un SIGSEGV dans `String(localized:)`,
// et rien d'autre ne le vérifie : le catalogue compile, et seule la langue de
// l'appareil qui tombe sur la mauvaise ligne plante (build 10, anglais, le
// pavé PIN). Les préfixes de position tombent : `%1$lld` et `%lld` remplissent
// le même argument. `%%` est un pour cent littéral.
const specifiers = (format) =>
  [...format.replaceAll("%%", "").matchAll(/%(?:\d+\$)?(lld|ld|d|@|f|s|u)/g)]
    .map(([, type]) => type)
    .sort();

/**
 * Les formats que `String(localized:)` rendra vraiment, par clé et par langue.
 *
 * Une localisation à `substitutions` est lue par ses variations, `%arg` tenant
 * la place du spécificateur propre à la substitution ; son gabarit `%#@nom@`
 * ne porte aucun spécificateur et n'est pas comparé.
 */
const iosFormats = (catalog) =>
  Object.entries(catalog.strings).flatMap(([key, entry]) =>
    Object.entries(entry.localizations ?? {}).flatMap(([lang, node]) => {
      const values = node.substitutions
        ? Object.values(node.substitutions).flatMap(
            ({ formatSpecifier, variations }) =>
              stringUnitValues(variations).map((value) =>
                value.replaceAll("%arg", `%${formatSpecifier}`),
              ),
          )
        : stringUnitValues(node);
      return values.map((value) => ({ key, lang, value }));
    }),
  );

const specifierMismatches = (catalog) =>
  iosFormats(catalog).flatMap(({ key, lang, value }) => {
    const expected = specifiers(key);
    const found = specifiers(value);
    return found.join() === expected.join()
      ? []
      : [`  ${lang} → ${key} : [${found}] au lieu de [${expected}]`];
  });

test("chaque traduction iOS garde les spécificateurs de sa clé", () => {
  const catalog = JSON.parse(read(IOS_CATALOG));

  // Un changement de forme du catalogue rendrait le garde vert sur zéro ligne.
  assert.ok(
    iosFormats(catalog).length > 1000,
    `Moins de 1000 formats lus dans ${IOS_CATALOG}. Le garde ne prouverait rien.`,
  );
  assert.deepEqual(
    specifierMismatches(catalog),
    [],
    `Chaque traduction de ${IOS_CATALOG} garde les spécificateurs de sa clé.`,
  );

  // Et il voit bien une ligne fautive : le crash du build 10, rejoué en mémoire.
  const broken = structuredClone(catalog);
  const node =
    broken.strings["%lld chiffres sur %lld saisis"].localizations.en.stringUnit;
  node.value = node.value.replace("%lld", "%@");
  assert.deepEqual(specifierMismatches(broken), [
    "  en → %lld chiffres sur %lld saisis : [@,lld] au lieu de [lld,lld]",
  ]);

  // Et sous une substitution aussi, là où `%arg` prend le spécificateur déclaré.
  const brokenSubstitution = structuredClone(catalog);
  const plural =
    brokenSubstitution.strings["%lld chiffres sur %lld saisis"].localizations.it
      .substitutions.digits.variations.plural.other.stringUnit;
  plural.value = plural.value.replace("%2$lld", "%@");
  assert.deepEqual(specifierMismatches(brokenSubstitution), [
    "  it → %lld chiffres sur %lld saisis : [@,lld] au lieu de [lld,lld]",
  ]);
});

/**
 * Les deux gardes qui suivent lisent les deux clients d'un coup, parce que la
 * règle qu'ils tiennent est la même des deux côtés et qu'un mot ne se corrige
 * jamais sur une seule plateforme. La source est nommée dans la ligne fautive.
 */
const everyTranslation = () => [
  ...catalogs().flatMap(({ file, lang }) =>
    flatten(JSON.parse(read(`${I18N_ROOT}/${file}`))).map(([key, value]) => ({
      source: `${I18N_ROOT}/${file}`,
      lang,
      key,
      value,
    })),
  ),
  ...iosTranslations().map(({ key, lang, value }) => ({
    source: IOS_CATALOG,
    lang,
    key,
    value,
  })),
  ...androidTranslations().map(({ key, lang, value }) => ({
    source: ANDROID_I18N_ROOT,
    lang,
    key,
    value,
  })),
];

// Pointer est un geste de l'utilisateur, pas un règlement bancaire : Pulpe ne
// voit jamais passer l'argent. Un verbe de banque promettrait donc un fait que
// l'app ne constate pas — c'est la divergence n°2 de docs/I18N.md, et elle se
// perd à la première traduction faite au fil du texte.
const BANKING_VERB_BY_LANG = {
  fr: /\b(débit[ée]e?s?|rapproch[ée]e?s?)\b/i,
  en: /\b(cleared|reconciled|debited)\b/i,
  de: /\b(gebucht|abgebucht)\b/i,
  it: /\b(addebitat[oaie]|riconciliat[oaie])\b/i,
};

test("aucune traduction ne pointe avec un verbe bancaire", () => {
  const offenders = everyTranslation()
    .filter(({ lang, value }) => BANKING_VERB_BY_LANG[lang]?.test(value))
    .map(
      ({ source, lang, key, value }) =>
        `  ${source} → ${lang}.${key} = ${value}`,
    );

  assert.equal(
    offenders.length,
    0,
    "Pulpe n'a aucun lien bancaire : « Pointé » ne se traduit ni par cleared,\n" +
      "reconciled, gebucht ni addebitato (docs/I18N.md, divergence n°2).\n" +
      `${offenders.join("\n")}`,
  );
});

test("l'allemand de Pulpe n'écrit jamais ß", () => {
  const offenders = everyTranslation()
    .filter(({ lang, value }) => lang === "de" && value.includes("ß"))
    .map(({ source, key, value }) => `  ${source} → de.${key} = ${value}`);

  assert.equal(
    offenders.length,
    0,
    "L'allemand de Pulpe est suisse : ß s'écrit ss.\n" + offenders.join("\n"),
  );
});
