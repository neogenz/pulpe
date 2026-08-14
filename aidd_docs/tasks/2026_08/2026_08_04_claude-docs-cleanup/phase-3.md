---
status: done
---

# Instruction: Correctness des règles restantes

Les règles survivantes qui enseignent un symbole inexistant, une API périmée ou une valeur que la CI refuse. Chacune produit du code faux de façon déterministe. Aucun trim ici : uniquement des corrections de fait.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.claude/rules/
├── 00-architecture/
│   ├── ios-architecture.md                          ✏️ BudgetDetailsViewModel inexistant + plafond 500→350
│   ├── feature-dialog-services.md                   ✏️ chemin core/dialogs/ interdit par eslint
│   └── layer-pattern.md                             ✏️ interdiction de services contredite par eslint
├── 01-standards/
│   ├── coding-rules.md                              ✏️ #private sans exception NG1053 + paths trop large
│   ├── clean-code.md                                ✏️ 4 seuils numériques contredits par les configs
│   └── import-organization.md                       ✏️ « no barrels » contredit par 8 barrels vivants
├── 02-programming-languages/
│   └── swift.md                                     ✏️ snippet StoreProtocol non conforme
├── 03-frameworks-and-libraries/
│   ├── angular-store-pattern.md                     ✏️ freshTime/gcTime → API inexistante
│   ├── angular-signals.md                           ✏️ httpResource contourne ApiClient + Zod
│   ├── angular-material-22.md                       ✏️ « removed in v21 » faux + namespace --p-*
│   ├── supabase.md                                  ✏️ supabase db reset interdit par CLAUDE.md
│   └── swiftui.md                                   ✏️ glassEffect iOS 26 sur cible iOS 18
├── 05-workflows-and-processes/
│   ├── logging.md                                   ✏️ logger.error absent de InfoLogger
│   ├── encryption-backend.md                        ✏️ 5 colonnes chiffrées manquantes
│   ├── error-handling-backend.md                    ✏️ chemin error-definitions mort
│   └── posthog-privacy.md                           ✏️ samples au CurrencyPipe natif
├── 06-templates-and-models/
│   └── design-system.md                             ✏️ namespace --p-* et 4 fichiers SCSS fictifs
└── 07-quality-assurance/
    └── testing-swift-testing.md                     ✏️ « NEVER import XCTest » casse PulpeUITests
```

## Tasks to do

### `1)` Les deux règles qui cassent la compilation

> À traiter en premier : un agent qui les suit produit du code qui ne compile pas.

1. `logging.md` : les exemples utilisent `this.logger.error(...)`. Or `backend-nest/src/common/logger/info-logger.interface.ts` définit `InfoLogger = Pick<PinoLogger, 'info'|'debug'|'warn'|'trace'>` — `error()` en est **explicitement exclu**, avec le principe « Log or Throw, Never Both » en commentaire. `ErrorLogger` (`error`/`fatal`) est réservé au `GlobalExceptionFilter`. Réécrire les exemples sur la vraie surface et énoncer le principe, qui est la vraie information du fichier.
2. `angular-store-pattern.md:244-317` : supprimer la section `freshTime` / `gcTime`. `ngx-ziflux@0.2.0` expose `staleTime` / `expireTime`. Vérifier les noms dans `frontend/node_modules/ngx-ziflux/**/*.d.ts` avant de réécrire, ou supprimer la section si `angular-cache-swr.md` la couvre déjà.

### `2)` Les symboles inexistants

1. `ios-architecture.md:99-123` : enseigne `BudgetDetailsViewModel`. La classe **n'existe pas** — l'architecture réelle de la feature est Coordinator + Projector + Router, documentée par `budget-details-feature-architecture.md`. Deux règles chargées ensemble se contredisent. Supprimer les références et renvoyer vers la règle de feature.
2. Signaler séparément : trois fichiers Swift réels portent encore `BudgetDetailsViewModel` dans leurs commentaires de doc (`BudgetLineDetailPage.swift:7`, `AddAllocatedTransactionPage.swift:6`, `EditTransactionPage.swift:6`). Hors périmètre de ce plan — ne pas les corriger ici.
3. `feature-dialog-services.md:114` : le chemin `core/dialogs/` déclenche une erreur de lint (`eslint-plugin-boundaries`). Remplacer par le chemin réel.
4. `error-handling-backend.md:45` : chemin `error-definitions` mort. Corriger ou supprimer la référence.

### `3)` Les valeurs que la CI refuse

1. `ios-architecture.md:216` : plafond « 500+ lines ». Le test d'architecture réel impose `let limit = 350` (`ios/PulpeTests/Architecture/BudgetDetailsArchitectureTests.swift:74`). Corriger en 350.
2. `clean-code.md` : aligner les quatre seuils numériques sur `frontend/eslint.config.js` et `.swiftlint.yml`. Deux seuils concurrents, c'est celui qui n'est pas appliqué qui devient du bruit trompeur.
3. `import-organization.md:32` : supprimer « no barrels » — 8 barrels vivants dans le repo. Une règle que la codebase viole partout est soit fausse, soit non appliquée ; dans les deux cas elle ne doit pas être énoncée en absolu.

### `4)` Les contradictions internes

> « If two rules contradict each other, Claude may pick one arbitrarily » — doc officielle.

1. `coding-rules.md:10-12` impose `#` pour **tous** les membres privés, sur glob `**/*.ts`, sans exception NG1053. Contredit `angular-signals.md:108` et `frontend/CLAUDE.md:43`, et le compilateur Angular refuse `#` sur `viewChild`/`viewChildren`/`contentChild`/`contentChildren`/`input`/`output`/`model`. Deux corrections : ajouter l'exception, **et** restreindre `paths:` à `backend-nest/**/*.ts, shared/**/*.ts` pour que la règle cesse de s'appliquer au frontend.
2. `layer-pattern.md:46` interdit les services dans `pattern/`, alors que `layer-ui.md` et la config eslint les autorisent. Supprimer l'interdiction.
3. `supabase.md:112,123` recommande `supabase db reset`, qui laisse la base locale en seed non chiffré (montants à 0). Remplacer par le wrapper local `bun run supabase:reset` depuis `backend-nest/`.
4. `posthog-privacy.md` : les samples utilisent le `CurrencyPipe` natif, ce que la règle devise interdit. Remplacer par `appCurrency`.

### `5)` Les affirmations de version fausses

1. `swiftui.md:216-231` : `glassEffect` est iOS 26 ; la cible de déploiement est **iOS 18.0** (`ios/project.yml:5-6`). Envelopper dans `if #available(iOS 26, *)` ou supprimer le bloc.
2. `angular-material-22.md:35-46` : l'affirmation « removed in v21 » est fausse, les APIs citées vivent. Supprimer.
3. `angular-material-22.md` + `design-system.md` : supprimer le namespace `--p-*`, qui n'existe pas dans les tokens. Ne garder que `--pulpe-*`, vérifié. Dans `design-system.md`, supprimer aussi les 4 fichiers SCSS nommés qui n'existent pas ; conserver la spec state-card, vérifiée.
4. `swift.md:210-217` : le snippet `StoreProtocol` ne correspond pas au protocole réel. Copié tel quel, il ne compile pas. Corriger sur la définition réelle.

### `6)` Les interdictions trop larges

1. `testing-swift-testing.md:18` : « NEVER import XCTest » en absolu casse `PulpeUITests/`, qui en a besoin. Scoper : interdit dans `PulpeTests/`, requis dans `PulpeUITests/`.
2. `encryption-backend.md:29-38` : compléter les 5 colonnes chiffrées manquantes. Une colonne non listée, c'est un montant financier écrit en clair. Vérifier la liste contre `docs/ENCRYPTION.md` et l'implémentation réelle du port. Retirer aussi l'affirmation RLS abrogée par migration (ligne ~120).

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Aucun exemple de règle n'appelle une méthode absente de l'interface réellement injectée ; aucun n'utilise `freshTime` ni `gcTime`                             |
| 2    | `grep -r "BudgetDetailsViewModel" .claude/rules/` ne renvoie rien ; tout chemin cité dans une règle existe sur disque                                        |
| 3    | Chaque seuil numérique d'une règle est égal à celui appliqué par eslint, SwiftLint ou le test d'architecture correspondant                                    |
| 4    | Aucune paire de règles chargées sur le même fichier ne donne deux consignes opposées ; `coding-rules.md` ne se déclenche plus sur un fichier frontend         |
| 5    | Toute API citée existe dans la version installée ; tout appel iOS 26 est gardé par `if #available` ; les snippets se compilent contre les vrais types         |
| 6    | Aucune interdiction absolue ne casse un usage légitime ; la liste des colonnes chiffrées est complète et vérifiée contre `docs/ENCRYPTION.md`                 |
| —    | Le scan de chemins morts sur `.claude/rules/` ne signale plus aucune référence manquante                                                                     |
