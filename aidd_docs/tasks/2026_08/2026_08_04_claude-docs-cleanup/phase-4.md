---
status: done
---

# Instruction: CLAUDE.md de package, agents, commands

Les 4 `CLAUDE.md` de package sont payés à chaque tour dans leur package, et sont partout la **copie dégradée** d'une règle `.claude/rules/` qui couvre exactement la même portée. Les agents et commands, eux, portent 4 erreurs factuelles chacun.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── frontend/CLAUDE.md                      ✏️ chemin mort, helper sans appelant, convention fausse, ::ng-deep ×2
├── backend-nest/CLAUDE.md                  ✏️ 3 sections dupliquées, Key Tables stale, extension de test fausse
├── ios/CLAUDE.md                           ✏️ 6 faits faux dont 2 qui font échouer les tests
├── shared/CLAUDE.md                        ✏️ ~60 l sur 80 dupliquent shared-schemas.md
└── .claude/
    ├── agents/
    │   ├── tech-lead.md                    ✏️ EncryptionService, class-validator, XCTest : 3 stacks inexistantes
    │   ├── ios-developer.md                ✏️ 4 erreurs factuelles
    │   ├── frontend-developer.md           ✏️ vocabulaire sans accents + rappels quality
    │   ├── backend-developer.md            ✏️ 3 rappels quality redondants
    │   └── ux-ui-designer.md               ✏️ vocabulaire sans accents
    └── commands/angular/review.md          ✏️ 7 chemins source morts
```

## Tasks to do

### `1)` `ios/CLAUDE.md` — les deux items qui cassent les tests

> À traiter en premier : ces deux lignes ont un coût immédiat.

1. Lignes 25 et 27 : les deux commandes `xcodebuild test` épinglent `OS=26.2`. `xcrun simctl list runtimes` ne montre que 18.0, 18.1, 18.2, 18.4, 18.5 et **26.5**. La destination ne se résout pas. Supprimer le suffixe `,OS=` — la cible de déploiement est iOS 18.0, épingler une version est inutile.
2. Lignes 22, 25, 27 : les commandes ciblent `name=iPhone 17 Pro Max`, qui est le simulateur **interactif de Maxime (Booted)**, alors qu'un device dédié `Pulpe Tests` existe et est shut-down. Retarger sur `Pulpe Tests`. La mémoire `feedback_dedicated_test_simulator` dit déjà l'inverse de ce fichier.

### `2)` `ios/CLAUDE.md` — les quatre faits faux restants

1. Ligne 51 : `BudgetLineStateChip` — 0 occurrence dans `ios/Pulpe`. Un TODO garé dans un fichier injecté à chaque session iOS. Supprimer la ligne.
2. Lignes 44 et 55 : la signature `FormTextField(hint:text:label:accessibilityLabel:)` ne compile pas — `focusBinding:` et `field:` sont requis, sans valeur par défaut. Corriger sur la déclaration réelle, et supprimer les deux entrées de la checklist qui répètent des lignes de la table juste au-dessus.
3. Ligne 47 : pousse `Decimal.asCHF` / `.asCompactCHF`, des shims CHF-hardcodés, alors que l'app est multi-devise. Remplacer par `asCurrency(_:)` / `asCompactCurrency(_:)`. En l'état, la table fait afficher le mauvais symbole aux utilisateurs EUR.
4. Lignes 62-65 : la table de vocabulaire mappe `BudgetLine → Catégorie`. « Catégorie » : **0 hit** dans les sources Swift ; « Prévision » : 11 hits. Elle contredit le `CLAUDE.md` racine qu'elle prétend étendre. Corriger ou supprimer la table.
5. Ligne 36 : aligner le seuil d'extraction sur 3+ (racine), et réécrire la phrase cassée « Never hand-roll UI shared component provide », qui n'a pas de verbe.
6. Ligne 5 : supprimer la hiérarchie des design docs — `CLAUDE.md:104` l'énonce déjà, y compris la mise en garde sur le sidecar.
7. **Ne pas toucher aux lignes 7-32** : le bloc XcodeGen (`--use-cache`), les noms de schémas et les arguments de `bump-version.sh` sont tous vérifiés. C'est le meilleur contenu des quatre fichiers.

### `3)` `frontend/CLAUDE.md`

1. Ligne 33 : `.claude/rules/testing/vitest.md` n'existe pas → `.claude/rules/07-quality-assurance/testing-vitest.md`.
2. Ligne 36 : `createMockResourceRef<T>()` a **zéro appelant** — il ne subsiste que sa définition, antérieure à la migration ziflux. Remplacer par `createMockDataCache()`, ou supprimer la ligne.
3. Ligne 35 : la convention `data-testid` « feature-component-element » n'est pas suivie — sur 447 ids uniques, 84 n'ont pas trois segments (`page-title`, `logout-button`, `email-input`…). Décrire la vraie convention ou supprimer la ligne. Ne pas donner un exemple d'id qui n'existe pas.
4. Ligne 40 : supprimer le doublon `NEVER ::ng-deep` (déjà ligne 29, dans un fichier de 43 lignes).
5. Lignes 41-42 : supprimer — l'isolation entre features est appliquée par `eslint-plugin-boundaries` en `default: "disallow"`, et OnPush + signals est déjà dans `layer-ui.md` et `angular-signals.md`, tous deux scopés frontend.
6. Ligne 10 : `pnpm run lint` est plus faible que ce que lefthook et le CLAUDE.md racine imposent. Supprimer ou renvoyer vers `pnpm quality` depuis la racine.
7. Ajouter `ngx-ziflux` à la table Stack : c'est la couche de données réelle et elle n'y figure pas.

### `4)` `backend-nest/CLAUDE.md`

1. Ligne 9 : `bun test path/to/file.test.ts` → `.spec.ts` (136 contre 2).
2. Ligne 10 : la description de `bun run quality` omet `lint:arch` (`depcruise`), qui est précisément le gate appliquant la règle de couches que ce fichier documente.
3. Lignes 41-46 « Key Tables » : la liste omet `budget_line`, l'entité centrale. Les 11 tables réelles sont dans `src/types/database.types.ts` — soit lister juste, soit supprimer la section et pointer le fichier.
4. Supprimer les sections Module Structure (17-30), Data Flow (32-39) et Critical Rules (54-61) : toutes vivent dans `nestjs-architecture.md`, `nestjs-api-contracts.md`, `encryption-backend.md`, `logging.md` et `typescript.md`, qui s'activent sur les mêmes fichiers et sont strictement plus riches.
5. Supprimer la ligne 14 (lefthook applique) et le doublon ligne 61 (`generate-types:local` est déjà ligne 15 et dans le CLAUDE.md racine).
6. Ajouter le chemin `src/test/test-mocks.ts` à côté de `createMockSupabaseClient()`, aujourd'hui non actionnable sans grep.

### `5)` `shared/CLAUDE.md`

1. Réduire à ~10 lignes : les 3 commandes (vérifiées dans `shared/package.json`) et un inventaire de fichiers correct.
2. L'inventaire actuel oublie `index.ts` (le point d'entrée du package), `src/currency.ts`, `src/currency-format.ts`, `src/error-codes.ts` et `src/feature-flags.ts`, et met en avant `src/types.ts`, le plus petit fichier du package (454 octets).
3. Tout le reste (lignes 18-80) est couvert par `shared-schemas.md`, scopé `shared/**/*.ts`. Les 4 « Critical Rules » y figurent toutes.
4. Corriger ou supprimer la consigne « build shared first » : turbo l'ordonne déjà (`quality` a `dependsOn: ["^build"]`). Elle n'est vraie que hors turbo, ce que le fichier ne dit pas.

### `6)` Les 5 agents

1. `tech-lead.md:20,91` : `EncryptionService` n'existe pas → `ENCRYPTION_PORT`.
2. `tech-lead.md:79,85` : `class-validator` → `createZodDto` ; `XCTest` → Swift Testing. Deux stacks jamais utilisées dans ce repo.
3. `ios-developer.md` : supprimer `BudgetDetailsViewModel` ; corriger les dépendances SPM ; corriger les commandes de test (`-only-testing:` produit un faux vert sur une suite Swift Testing) ; `asCHF` est un suffixe, pas un préfixe.
4. Vocabulaire : `frontend-developer.md:99-101` et `ux-ui-designer.md:83-88` écrivent `Recurrent` et `Prevu` **sans accents**, pour de l'UI en français. Remplacer les copies par un renvoi à `CLAUDE.md § Vocabulary` (idem `ios-developer.md:161-162`, `tech-lead.md`).
5. Supprimer les 9 rappels `pnpm quality` de `backend-developer.md:96,104,118`, `tech-lead.md:39,90`, `frontend-developer.md:105,113,125`.

### `7)` `.claude/commands/angular/review.md`

1. Corriger les 7 chemins source morts. La commande exige des citations de fichiers : sur des chemins inexistants, elle en **invente**.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Les commandes de test iOS du fichier s'exécutent sans erreur de destination et n'utilisent pas le simulateur interactif                                    |
| 2    | Tout symbole Swift cité dans `ios/CLAUDE.md` existe ; toute signature citée compile ; le vocabulaire correspond aux chaînes réelles de l'app               |
| 3    | Le lien vers les règles résout ; tout helper cité a au moins un appelant ; `::ng-deep` n'apparaît qu'une fois                                              |
| 4    | `backend-nest/CLAUDE.md` ≤ 30 lignes, sans section dupliquée d'une règle ; la liste des tables est juste ou absente                                        |
| 5    | `shared/CLAUDE.md` ≤ 15 lignes ; l'inventaire nomme `index.ts` ; aucune règle Zod n'y est répétée                                                          |
| 6    | Aucun agent ne nomme un symbole ou une stack absente du repo ; le vocabulaire accentué n'existe qu'à un seul endroit                                       |
| 7    | Tout chemin cité par la command existe                                                                                                                    |
| —    | Total des 4 `CLAUDE.md` de package sous 120 lignes, contre 250                                                                                            |
