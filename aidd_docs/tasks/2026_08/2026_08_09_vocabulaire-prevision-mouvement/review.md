# Review: PR #594 — home assise sur le réalisé, et vocabulaire unifié

- **Verdict**: changes-requested
- **Diff**: `713246ec...62ad5dd0` (121 fichiers, +7512/−1507, 110 commits)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_11
- **Findings**: 0 critical, 6 warning, 7 minor

## Phases

Deux plans sont dans le périmètre de cette PR. Le troisième chantier — la home, qui donne son titre à la PR et porte ~90 des 110 commits — n'a pas de dossier de plan, donc aucun critère à tracer (R4).

### Phase 1 — Web, sweep lexical (`2026_08_09_vocabulaire-prevision-mouvement`)

- [x] Chaque clé touchée porte une famille, règle écrite une seule fois — `phase-1.md:tâche 1`, effet uniforme dans `fr.json` : erreurs sans sujet, collections au pluriel, objet seul au verbe ou nommé
- [x] Aucun écran webapp n'affiche « transaction » ; le tour ne qualifie plus une prévision de mouvement — `fr.json` : « À pointer signifie que **la prévision** ne s'est pas encore réalisée » ; garde vert
- [x] Suites unitaire et e2e vertes sans sélecteur affaibli — 294 tests / 13 fichiers verts ; l'e2e ne perd qu'un lecteur mort (`current-month.page.ts`)
- [x] Messages d'erreur compréhensibles sans le modèle de données — `fr.json` : « L'ajout a échoué — réessaie », « Le pointage a échoué — réessaie »
- [x] Réintroduire « transaction » dans une valeur de `fr.json` fait échouer `pnpm quality`, message actionnable — `lexicon.test.mjs:30-40`, `HOW_TO_WRITE_IT_INSTEAD` donne les quatre portées
- [x] `CLAUDE.md` et `PRODUCT.md` disent les trois portées — `CLAUDE.md:37`, `PRODUCT.md:46`

### Phase 2 — Web, les deux formulaires

- [x] Changer la nature change le titre, le lecteur d'écran suit — `fr.json:978` `"addTransactionTitle": "Noter {{ nature }}"`, `fr.json:559` `"newForecast": "Prévoir {{ nature }}"`
- [x] Sous le titre, la première chose lue est ce qui distingue l'écran — date côté mouvement, `une fois / lissé` côté prévision
- [x] Aucun formulaire n'affiche « transaction » ; le flux autonome ne mentionne plus le rattachement — `forecastTypeLabel` passe de « Type » à « Nature »
- [x] Depuis la homepage, le premier mot lu est un verbe — `fr.json:979` `"addTransactionFab": "Noter une dépense"`
- [x] À 375px le bloc commun reste atteignable ; porteur du verbe tranché et noté avant la phase 3 — mesure consignée dans l'en-tête de `phase-2.md` (boîte du titre stable à left=617/top=39/height=66, select visible à 39 vs 230 sur 621px). Relevé par l'implémenteur, non rejoué ici : revue statique

### Phase 3 — iOS, parité lexicale

- [x] Aucun écran iOS n'affiche « transaction » — 34 littéraux réécrits ; seule occurrence restante `WhatsNewSheet.swift:253`, dans un `#Preview` non embarqué (C2)
- [x] Journalisation intacte, note de version publiée non réécrite — `WhatsNewSheet.swift` non modifiée
- [x] Parité terme à terme iOS ↔ web — `KindToggle` dit « Nature » comme `forecastTypeLabel` ; `CheckedToggle` dit « Déjà pointé » comme `fr.json:614`
- [ ] Réintroduire « transaction » dans un littéral d'interface Swift fait échouer `pnpm quality` — **faux pour les littéraux multi-lignes**. Le garde lit ligne par ligne et n'apparie que des `"…"` : injecter `Cette transaction est un test.` dans le `Text("""…""")` de `EditTemplateLineSheet.swift:135` laisse les deux tests verts (C1)

### Phase 4 — iOS, les deux sheets

- [x] Verbe au même endroit que le web, ordre des blocs celui du web — `TransactionEnums.swift:58,60` ; `AddTransactionSheet.swift:113→122` titre puis `dateSelector` ; `AddBudgetLineSheet.swift:122→136` titre, nature, puis `SpreadModeToggle`
- [x] Montant visible au premier detent, aucune marge fantôme clavier — `SheetFormContainer` appelle `standardSheetPresentation()` (detent unique `.large`) ; aucun `.ignoresSafeArea(.keyboard)` dans les deux sheets ni leur conteneur
- [x] Suite iOS verte, mêmes ordres de lecture des deux côtés — 2031 tests / 212 suites consignés dans le verdict de `phase-4.md`

### Phase 1 — Portance bimodale de la carte (`2026_08_11_followups-dark-card-et-plafond-tests`)

Revérifiée au tip contre le `review.md` déjà présent dans ce dossier.

- [x] `Color.rowCardBorder` existe, `.clear` en clair / `outlineVariant` en dark, aucun hex nouveau — `Color+Pulpe.swift:425`
- [x] Contour continu non rogné, clair inchangé — `View+Extensions.swift:333-336`, `strokeBorder` posé hors du `clipShape`
- [x] Plus aucun `.background(Color.surfaceContainerLowest)` accolé à `.shadow(Shadow.subtle)` — 0 occurrence dans tout `ios/Pulpe/` ; `0fb77fc4d` a soldé les 4 restantes signalées par la revue précédente
- [x] Build + `swiftlint --strict` propres — vérifiés en amont, arbre identique au tip

### Phase 2 — Découper les deux structs hors cap

- [ ] Compte de tests de référence relevé **et cité** — aucun chiffre pré-découpage dans le dépôt. L'égalité des `@Test` le remplace (17 → 10+7, 8 → 6+2), établie ici et non par la phase
- [x] Aucun helper dupliqué — `ProjectionTestStack` et `BudgetLineSpreadFixtures` détiennent chacun sa copie unique
- [ ] `.serialized` sur chaque nouvelle suite **et** aucune modification d'assertion — `.serialized` : 4/4. Assertions : 6 lignes réécrites dans `06bce3465` (`checkedTickHash(for:)` hissé en `let`, chute des `Self.`). Sémantique préservée dans les 6 cas, et la réécriture est imposée par la tâche 2 du plan, qui sort les helpers du type
- [x] Compte identique, plus aucun `type_body_length` dans `ios/PulpeTests/` — 17=17, 8=8

### Phase 3 — Solder les ombres mortes en dark

- [ ] Tableau site → fond → verdict couvrant les 7 sites — absent du dépôt : le dossier ne porte que `plan.md` et trois `phase-*.md`
- [x] Tout site modifié est `morte`, aucun site `vivante` dans le diff — seuls `BudgetListView+Subviews.swift` et la carte hero changent
- [x] Aucun nouveau token sans justification écrite — justification en `Color+Pulpe.swift:420-424`
- [x] Build, `swiftlint --strict`, clair inchangé — `rowCardBorder` vaut `.clear` en clair

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | code | Vocab 3 | `.github/scripts/lexicon.test.mjs:88` | Le garde Swift découpe en lignes puis apparie des `"…"`. Les lignes intérieures d'un littéral `"""` ne portent aucun guillemet : elles ne sont jamais inspectées. Prouvé par mutation — `Cette transaction est un test.` inséré dans le `Text("""…""")` affiché de `EditTemplateLineSheet.swift:135` laisse `pass 2 / fail 0`. Cinq fichiers de `ios/Pulpe` emploient `"""`, dont de la prose affichée et les descriptions VoiceOver de `HomeHeroCard.swift:309,324` | Suivre l'état ouvert/fermé de `"""` sur la boucle de lignes, et soumettre les lignes encloses à `isDisplayedProse` comme les autres |
| 🟡 | functional | Vocab 3 | `.github/scripts/lexicon.test.mjs:88` | Critère 4 de la phase 3 non tenu : réintroduire « transaction » dans un littéral d'interface Swift ne fait pas échouer `pnpm quality` dès lors que le littéral est multi-lignes. Le lot livré est propre en fait ; c'est la garde contre la régression qui est trouée | Même correctif que C1, puis rejouer la preuve dans les deux sens sur un `"""` |
| 🟡 | rot | Vocab 3 | `.github/scripts/lexicon.test.mjs:71` | `NOT_APP_COPY` sort `WhatsNewSheet.swift` entier du garde au motif qu'il « porte une note de version publiée ». La seule occurrence du mot y est ligne 253, **dans un `#Preview`** ; les notes réellement affichées viennent de `WhatsNewService`/`WhatsNewStore`. Un fichier entier est donc exempté à vie pour taire une vignette Xcode, et sa copie affichée (titres, boutons, état vide) n'est plus surveillée | Sauter les blocs `#Preview` (le garde n'en saute aujourd'hui que la ligne d'ouverture) et retirer l'exemption de fichier |
| 🟡 | conform | - | PR #594 (121 fichiers, ~6000 LOC nettes) | `CLAUDE.md § Scope Discipline` : « Past ~300 net LOC, stop and propose 2-3 alternatives before continuing. » La PR fait 20× ce plafond et empile trois chantiers — home, vocabulaire, follow-ups dark/tests — dont un sans plan. La règle nomme le coût exact : le nettoyage d'après une fonctionnalité sur-livrée | Rien à défaire ici. Découper à la prochaine occasion : la home, le vocabulaire et les follow-ups sont trois PR indépendantes, aucune ne dépendant du diff des autres |
| 🟡 | functional | FU 2 | `aidd_docs/tasks/2026_08/2026_08_11_followups-dark-card-et-plafond-tests/` | Critère 1 de la phase 2 : « Un compte de tests de référence est relevé **et cité**, pas supposé. » Aucun chiffre pré-découpage n'existe dans le dépôt. Le risque que le critère couvre — un `-only-testing:` qui ne matche rien et rend `TEST SUCCEEDED` à zéro test — reste donc non écarté par la phase | Consigner le compte dans le dossier, ou remplacer le critère par l'égalité des `@Test` avant/après, qui est vérifiable après coup |
| 🟡 | functional | FU 3 | `aidd_docs/tasks/2026_08/2026_08_11_followups-dark-card-et-plafond-tests/` | Critère 1 de la phase 3 : « **Ce tableau est le livrable de la tâche** », site → fond → verdict sur les 7 sites. Il n'est ni dans `phase-3.md`, ni dans un rapport. Les dossiers voisins (`2026_08_03_budget-details-resource-safety/`, `2026_08_02_savings-goal-horizon-500/`) en portent un | Écrire le tableau des 7 sites dans le dossier ; sans lui, le prochain qui cherche une ombre morte recommence le recensement |
| 🟢 | rot | FU 2 | `ios/PulpeTests/Domain/Services/BudgetLineSpreadTestFixtures.swift:15` | Le doc-comment juste au-dessus explique pourquoi un symbole global nu est un piège de liaison silencieuse dans cette cible — puis le fichier déclare `let fixtureGroupId` en global nu, hors de l'`enum` qu'il vient de justifier | `static let groupId` dans `BudgetLineSpreadFixtures`, appels préfixés comme les fonctions voisines |
| 🟢 | rot | FU 1, 3 | `View+Extensions.swift:335` · `BudgetListView+Subviews.swift:68,131` · `BudgetDetailsSkeletonView.swift:197` | `strokeBorder(Color.rowCardBorder, lineWidth: DesignTokens.BorderWidth.hairline)` est recopié à 4 endroits, 3 hors du modifier partagé. Signalé par la revue précédente du même dossier, toujours vivant au tip — `0fb77fc4d` a soldé les fonds de carte, pas les contours | Extraire `pulpeRowCardBorder(cornerRadius:)` dans `View+Extensions.swift` ; `pulpeRowCard()` le compose, les 3 sites manuels deviennent une ligne |
| 🟢 | code | FU 2 | `ios/PulpeTests/Features/Budgets/BudgetDetails/Projection/BudgetDetailsCheckedProjectionTests.swift:13` | `@Suite(.serialized)` sans nom, quand ses trois sœurs du même lot en portent un qui dit le thème (`@Suite("BudgetLineService.createSpread response decoding", .serialized)`) | `@Suite("BudgetDetails pointage projection", .serialized)` |
| 🟢 | conform | - | `dashboard-store.ts` (235/876 lignes) · `dashboard-hero.ts` (218/930) | `.claude/rules/01-standards/clean-code.md` range « Comments explaining code » parmi les anti-patterns. Ces commentaires-ci portent le *pourquoi* et l'historique des bugs, ce qui est légitime, mais à 25 % du fichier ils se lisent comme un journal de bord : le prochain lecteur doit trier ce qui régit encore le code de ce qui raconte un défaut soldé | Garder la raison, laisser tomber le récit du symptôme corrigé. Un `plan.md` ou un message de commit tient l'historique mieux qu'un en-tête de `computed` |
| 🟢 | fit | - | `aidd_docs/tasks/2026_08/` | Le chantier qui donne son titre à la PR — la home — n'a pas de dossier de plan, là où les deux autres du même lot en ont un. ~90 commits sans critère d'acceptation à opposer au diff : la revue fonctionnelle ne peut rien tracer sur la partie la plus lourde du changement | Ouvrir le dossier a posteriori avec l'objectif et les critères réellement tenus, ou l'assumer comme travail piloté par `/impeccable` et le dire dans la description de la PR |
| 🟢 | fit | Vocab 2, 4 | `phase-2.md` et `phase-4.md` (wireframes) vs `AddBudgetLineSheet.swift:205` · `budget-line/create/dialog.ts:436` | Les deux wireframes posent « (pas de (4) : on ne pointe pas une intention) » sur l'écran « Prévoir ». Les deux plateformes y affichent bien un « Déjà pointé » (`fr.json:614`, `CheckedToggle`), et l'affichaient déjà avant la PR. La parité web/iOS tient — c'est le wireframe qui décrit un écran qui n'existe pas | Corriger le wireframe, ou trancher que le pointage sort des deux formulaires de prévision. Ne pas laisser un plan livré décrire autre chose que le livré |
| 🟢 | fit | Vocab 3 | `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:253` | La description de la PR affirme « Le mot « transaction » ne s'affiche plus nulle part ». Vrai pour la surface embarquée, vérifié des deux côtés ; faux à la lettre pour le `#Preview` du canvas Xcode, et non garanti pour l'avenir tant que C1 tient | Formuler « ne s'affiche plus sur aucun écran de l'app, et un garde de dépôt l'y tient » |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 87 % (26/30 critères)                                                                                                                                                                                                                                                                                                                                          |
| Files checked | `.github/scripts/lexicon.test.mjs`, `package.json`, `CLAUDE.md`, `PRODUCT.md`, `frontend/projects/webapp/public/i18n/fr.json`, `feature/current-month/services/dashboard-store.ts`, `feature/current-month/current-month.ts`, `feature/current-month/components/add-transaction-{dialog,shell-data}.ts`, `ui/dashboard-hero/dashboard-hero.ts`, `core/auth/auth-interceptor.ts`, `core/storage/storage-{keys,schemas}.ts`, `budget/budget-details/budget-line/create/dialog.ts`, `backend-nest/.../supabase-budget.repository.ts`, `shared/index.ts`, `shared/src/calculators/{index,budget-formulas}.ts`, `ios/Pulpe/Domain/Models/TransactionEnums.swift`, `ios/Pulpe/Features/CurrentMonth/Components/AddTransactionSheet.swift`, `ios/Pulpe/Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift`, `ios/Pulpe/Shared/Extensions/{Color+Pulpe,View+Extensions}.swift`, `ios/Pulpe/Shared/Components/{KindToggle,WhatsNewSheet}.swift`, `ios/Pulpe/Features/Budgets/BudgetList/BudgetListView+Subviews.swift`, les 6 fichiers de test de `06bce3465` |
| Unchecked     | Vocab P3-4 garde des littéraux Swift multi-lignes — `fix` · FU P2-1 compte de tests de référence cité — `fix` · FU P2-3 « aucune modification d'assertion » — `not-applicable` (les 6 réécritures sont imposées par la tâche 2 du même plan, qui sort les helpers du type ; sémantique préservée) · FU P3-1 tableau des 7 sites — `fix`                            |
| Unplanned     | Chantier « home » entier (~90 commits) hors de tout plan · `supabase-budget.repository.ts:334` départage `created_at` par `id` — vraie cause racine du réordonnancement au pointage, hors périmètre des deux plans · `auth-interceptor.ts:94-103` redirige un 401 sans session vers la connexion sans appeler `signOut()`, ce qui aurait révoqué la session iOS · `add-transaction-shell-data.ts` créé pour rompre un cycle d'imports — `madge --circular` : « No circular dependency found! » · `.github/workflows/claude-code-review.yml` `--max-turns` 50 → 85 · `frontend/.gitignore` : bloc d'artefacts `impeccable-live` |
