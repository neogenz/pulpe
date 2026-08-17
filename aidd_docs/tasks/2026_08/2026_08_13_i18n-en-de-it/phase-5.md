---
status: done
---

# Instruction: iOS — lot A : Core, Domain, Shared

Le premier lot d'extraction, et le plus transverse : les erreurs réseau, les erreurs d'authentification, les composants partagés et les modèles. ~532 chaînes sur 147 fichiers. Il passe en premier parce que ces chaînes apparaissent sur tous les écrans des lots suivants — les traduire ailleurs qu'ici les traduirait quatre fois.

Le socle de la phase 4 est acquis : catalogue en place, formateurs séparés, sélecteur fonctionnel. Ce lot ne fait que remplir. Le diff Swift reste petit — la clé est le littéral français, donc `Text("…")` ne bouge pas ; le volume atterrit dans `Localizable.xcstrings`.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/Pulpe/
├── Core/                                        ✏️ 30 fichiers · ~276 chaînes
│   ├── Network/APIError.swift                   ✏️ 46 littéraux — la plus forte densité du dépôt
│   ├── Auth/AuthErrorLocalizer.swift            ✏️ 40 chaînes dans un dictionnaire clé Supabase -> (kind, message) — conversion la plus mécanique du lot
│   ├── Encryption/                              ✏️ copie du coffre et des clés de récupération
│   └── Analytics/                               ✏️ aucune chaîne affichée, vérifier seulement qu'aucun message localisé ne part en propriété
├── Domain/                                      ✏️ 51 fichiers · ~53 chaînes — surtout des libellés d'enum
│   └── Models/*+Display.swift                   ✏️ nativeName, compactLabel, fullLabel : des rawValues calculées, invisibles à l'extraction SwiftUI
├── Shared/                                      ✏️ 66 fichiers · ~203 chaînes
│   ├── Components/                              ✏️ TagPickerField, CapsulePicker, PulpeChip, EmptyState, WhatsNewSheet
│   ├── Formatters/Formatters.swift              ✏️ reliquat après la phase 4 : les 24 sous-titres mensuels
│   └── Extensions/                              ✏️ libellés d'accessibilité
└── Resources/Localizable.xcstrings              ✏️ ~532 entrées × 3 traductions
```

## User Journey

```mermaid
flowchart TD
  A[Build du target] --> B[Xcode extrait les littéraux des API localisables]
  B --> C{Chaîne visible mais non extraite}
  C -->|oui| D[Constante String ou rawValue - conversion manuelle en clé symbolique]
  C -->|non| E[Entrée présente dans le catalogue]
  D --> E
  E --> F[Traduction en en de it selon docs I18N.md]
  F --> G[Vérification écran par écran dans les quatre langues]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    App en allemand sur le simulateur dédié avec le compte de démo => état de départ connu: 5: system
  section Happy path
    Couper le réseau puis charger un budget => le message d'erreur est en allemand: 5: system
    Se connecter avec un mauvais mot de passe => l'erreur d'authentification est en allemand: 5: system
    Ouvrir une feuille partagée avec état vide => la copie est en allemand: 5: system
  section Edge case - chaîne non extraite
    Chercher les littéraux français restants dans Core Domain Shared => seuls restent des identifiants techniques: 1: cli
  section Edge case - repli
    Une entrée sans traduction allemande => l'écran rend le français et non la clé: 1: system
  section Teardown
    Repasser en français => baseline restaurée: 5: system
```

## Tasks to do

### `1)` Extraction automatique

1. Construire le target, laisser Xcode peupler le catalogue depuis les littéraux passés aux API localisables
2. Trier les entrées produites : celles qui sont de la copie, et celles qui sont des identifiants techniques capturés par erreur — 27 noms de symboles SF et 36 identifiants d'accessibilité existent dans l'app, la plupart déjà filtrés par leur forme
3. `APIError.swift` d'abord : 46 littéraux, tous des messages d'erreur utilisateur qui apparaissent partout ailleurs

### `2)` Chaînes invisibles à l'extraction

> L'extraction ne voit que les littéraux passés à une API localisable. Tout le reste reste français dans les quatre langues, en silence.

1. `AuthErrorLocalizer` : un dictionnaire `[String: (AuthErrorKind, String)]` — la clé Supabase est déjà stable, seul le message du tuple passe au catalogue. Conversion la plus mécanique du lot
2. Les `+Display.swift` du domaine : `nativeName`, `compactLabel`, `fullLabel` sont des propriétés calculées rendant des `String` — invisibles à l'extraction. Les convertir en `LocalizedStringResource`
3. Toute chaîne construite par concaténation ou interpolation doit devenir une clé unique à arguments positionnels
4. `TagPickerField.swift:118` (`"30 caractères maximum"`) illustre le cas où la contrainte chiffrée est dans la phrase : la clé porte l'argument, jamais le nombre en dur

### `3)` Traduction et libellés d'accessibilité

1. Traduire en `en`, `de`, `it` en suivant la table de `docs/I18N.md`
2. 230 occurrences d'`accessibilityLabel` existent sur 112 fichiers, dont une part dans ce lot. Ce sont des chaînes utilisateur au même titre que les autres — les traduire, ne pas les sauter parce qu'elles sont invisibles à l'œil
3. Les messages d'erreur suivent la règle de ton de `PRODUCT.md` : expliquer ce qui s'est passé, proposer une suite, sans culpabiliser

### `4)` Gardes

1. `pnpm test:lexicon` couvre à la fois le source Swift et les traductions du catalogue depuis la phase 4
2. `swiftlint --strict` tourne sur les fichiers indexés au commit et fait de 500 lignes le vrai plafond — une conversion qui allonge un fichier peut le franchir
3. Vérifier le compte de tests exécutés, pas le statut de sortie

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Le catalogue contient les entrées de `Core`, `Domain` et `Shared` ; aucune entrée n'a une valeur interpolée pour clé                                           |
| 2    | Une recherche de littéraux français accentués sur ces trois racines ne rend plus que des identifiants techniques, des journaux et des commentaires             |
| 3    | En allemand : une erreur réseau, une erreur d'authentification et un état vide rendent en allemand, y compris leurs libellés d'accessibilité lus par VoiceOver |
| 4    | `xcodebuild test` passe avec un compte non nul ; `pnpm test:lexicon` passe ; `swiftlint --strict` passe sur les fichiers touchés                               |

## Résultat

**Vert.** `xcodebuild test` : `✔ Test run with 2114 tests in 221 suites passed after 26.641 seconds.` (2108 avant, +6 dans le nouveau `APIErrorLocalizationTests`). `pnpm test:lexicon` : 5 tests verts. `swiftlint --strict` : sortie **identique au relevé d'avant-phase** (14 violations, toutes préexistantes et hors des fichiers touchés) — vérifié par `diff`, pas à l'œil. Zéro `ß` dans les traductions allemandes.

Catalogue : 624 → 761 clés, 64 → 248 traduites. Les 14 clés du lot A qui restent sans traduction sont toutes du décor de `#Preview` (`Trends content here`, `Muted`, `CHF 941.20`…) plus le séparateur `·`.

### Écarts avec la projection

1. **L'extraction voyait déjà `Core`, `Domain` et `Shared`… pour 5 clés sur 276.** La projection annonçait « le diff Swift reste petit, le volume atterrit dans le catalogue ». C'est l'inverse : presque tout le lot était **invisible** à l'extraction, parce que ces couches ne rendent pas du `Text` mais du `String`. 43 fichiers modifiés pour +137 clés.
2. **`APIError.errorDescription` s'est scindé.** `LocalizedError` impose `String?` sans paramètre, donc la langue ne pouvait venir que de l'état global. `message(in:)` porte maintenant la langue, `errorDescription` l'appelle avec celle de l'app, et `catalogKey` tient la table. Les quatre cas à charge utile (`conflict`, `validationError`, `serverError`, `unknown`) sont énumérés un par un plutôt que sous un `default` : un cas ajouté doit dire à quelle moitié il appartient.
3. **`AuthErrorLocalizer` n'a pas eu besoin d'être restructuré.** Retyper les trois tables en `[…: String.LocalizationValue]` a suffi : le compilateur extrait les littéraux `String.LocalizationValue` **même dans un littéral de dictionnaire**, ce qui n'était pas acquis. Mesuré avant de convertir, sur les sous-titres mensuels de la phase 4.
4. **`Text("a" + "b")` trouvé deux fois de plus** (`RealizedBalanceSheet`, `SavingsGoalPlannedWithdrawalPicker`). La concaténation rend un `String`, donc SwiftUI prend sa surcharge non localisante et la chaîne restait française dans les quatre langues, sans rien signaler.
5. **`indefiniteLabel` supprimé.** `"Noter \(indefiniteLabel)"` figeait l'ordre des mots français : l'allemand met le verbe à la fin (`Ausgabe erfassen`). Six clés entières ont remplacé deux gabarits, et la propriété n'avait aucun autre appelant.
6. **`legalDisclosure` a changé de signature.** Ses paramètres `prefix` / `connector` / `suffix` existaient pour l'accord de genre français. Deux phrases entières les remplacent, avec les deux URL en arguments — le traducteur voit deux `%@` et n'a aucun lien markdown à casser. Les deux `static let consentMarkdown` appelants sont devenus des propriétés calculées : un `static let` fige la langue du premier accès.
7. **Le pluriel des tags est passé au catalogue.** `count == 1 ? "tag" : "tags"` encodait la règle française pour tout le monde ; la clé `%lld tags` porte maintenant un jeu de règles par langue, français inclus (la clé seule ne peut pas dire « 1 tag »).
8. **`Mois Standard` volontairement laissé en français.** `docs/I18N.md` le déclare hors périmètre — c'est le serveur qui l'écrit dans les données. Le localiser côté iOS seul aurait fait diverger les plateformes sur une valeur persistée.
9. **Huit assertions de tests épinglent désormais la langue** (`message(in:)`, `localize(_:in:)`). Elles lisaient l'état global, que les suites de langue déplacent : c'est ce qui justifie le paramètre, sinon il n'aurait aucun appelant non-défaut.

### Mécanique, pour les lots suivants

- La boucle est : convertir → `xcodebuild build … SWIFT_EMIT_LOC_STRINGS=YES` (propre) → `xcstringstool sync` → traduire → rejouer. `xcodebuild` **n'écrit jamais** dans le catalogue.
- `AppLocale.string(…)` est bien vu par l'extracteur, y compris sur une interpolation — vérifié clé par clé, pas supposé.
- Ce qui reste hors catalogue dans ces trois racines : les journaux, les clés d'erreur Supabase (anglaises par contrat), les noms d'actifs et de polices, l'alphabet base32, `Face ID` / `Touch ID` / `Optic ID`, et `Français` — jamais traduit, par construction.
- Angle mort connu : les suites `AppLocaleTests` et `UserSettingsStoreLocaleTests` écrivent l'instantané partagé pendant quelques millisecondes. Les assertions françaises sans point d'injection (libellés d'enum) restent théoriquement exposées. Rien n'a bougé sur les deux exécutions complètes de ce lot ; à traiter si un jour ça clignote.
