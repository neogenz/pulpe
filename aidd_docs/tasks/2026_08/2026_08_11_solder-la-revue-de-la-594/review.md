# Review: solder la revue de la 594

- **Verdict**: approve
- **Diff**: `22e70d66a~1...87a59b4c8`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_11
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — le garde lexical voit toute la copie affichée

- [x] Un `transaction` dans un littéral `"""` affiché fait échouer `pnpm quality`, fichier et ligne cités — mutation vue rouge sur `EditTemplateLineSheet.swift:138`, `.github/scripts/lexicon.test.mjs:106`
- [x] Le même mot dans un `#Preview`, à n'importe quelle profondeur, ne déclenche rien — occurrence imbriquée dans un `if true { }` restée verte, `lexicon.test.mjs:137`
- [x] Aucune exemption de fichier ne subsiste, `WhatsNewSheet.swift` est lu comme les autres — `NOT_APP_COPY` supprimé, `lexicon.test.mjs:162`
- [x] Le garde vu échouer sur un littéral multi-lignes et sur un littéral d'une ligne, puis revert au vert — `KindToggle.swift:43` en négatif, arbre restauré, `pnpm quality` 12/12

### Phase 2 — un seul auteur au contour de carte

- [x] `pulpeCardBorder(cornerRadius:)` existe, exige son rayon, ne pose ni fond ni ombre — `View+Extensions.swift:334`
- [x] `pulpeRowCard()` rend le même contour et la même ombre, sans `strokeBorder` propre — `View+Extensions.swift:346`
- [x] Les trois sites appellent le modifier ; squelette sans ombre, hero à 32pt — `BudgetListView+Subviews.swift:63,122`, `BudgetDetailsSkeletonView.swift:193`
- [x] `strokeBorder(Color.rowCardBorder` n'apparaît plus qu'une fois — `View+Extensions.swift:337`, seul site du dépôt

### Phase 3 — les fixtures de spread n'exposent plus de symbole nu

- [x] Aucune valeur ni fonction de niveau fichier ; les 5 lectures passent par le type — `BudgetLineSpreadTestFixtures.swift:16`, `BudgetLineSpreadResponseTests.swift:31,33`
- [x] Chaque suite du découpage nomme son thème, `.serialized` conservé — `BudgetDetailsCheckedProjectionTests.swift:13`
- [x] Le compte de tests exécutés est identique au relevé d'avant — 9 = 9 sur la sélection identique, 25 sur les 4 suites

### Phase 4 — la home dit la règle, plus le récit du défaut

- [x] Le tri est écrit et appliqué aux deux fichiers de la même façon — critère « écrit de zéro aujourd'hui, encore vrai ? » appliqué bloc par bloc
- [x] Chaque sélecteur garde en 1 à 3 lignes ce qu'il compte et exclut, aucun montant d'écran révolu — `dashboard-store.ts` 235 → 149 lignes de commentaire
- [x] Chaque valeur de style contrainte par une mesure garde sa mesure — `4.68:1`, `3.8:1`, `347px of 295`, `109/104 → 138/133`, `DESIGN.md:118` conservés
- [x] Diff sans ligne de code, 294 tests, `ng build`, `prettier`, `eslint` propres — diff commentaires retirés vide sur les deux fichiers, 294/294

### Phase 5 — les plans décrivent ce qui a été livré

- [x] Les deux wireframes montrent le même écran que les formulaires — bloc (4) des deux côtés, adossé à `CheckedToggle.swift:15` et `budget-line/create/dialog.ts:433`
- [x] Le critère 1 de la phase 2 follow-ups se vérifie depuis git seul — 17 → 10 + 7, 8 → 6 + 2, mêmes 25 `@Test` de part et d'autre de `06bce3465`
- [x] Le tableau couvre les 7 sites d'ombre, verdicts adossés à une couleur relevée, raison écrite pour chaque site non corrigé — `followups/phase-3.md`, 3 verdicts dont `déjà bimodale`
- [x] La description de la PR n'affirme plus que la revue ne peut vérifier, origine du chantier « home » nommée — PR 594 éditée

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |

None. Les trois relevés du premier passage ont été corrigés dans `efb7c778f` et `87a59b4c8`, puis revérifiés : le garde perdait le fil sur un `{` cité en commentaire dans un `#Preview` et se taisait sur la suite du fichier (mesuré : `pass 2 / fail 0` avant, `AddTransactionSheet.swift:421` signalé après) ; `pulpeRowCardBorder` nommait la carte que ses trois appelants ne sont pas ; le critère 1 de la phase 3 promettait plus large que le piège décrit.

## Verification

| Metric        | Value                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (19/19)                                                                                                                                             |
| Files checked | `lexicon.test.mjs`, `View+Extensions.swift`, `BudgetListView+Subviews.swift`, `BudgetDetailsSkeletonView.swift`, `BudgetLineSpreadTestFixtures.swift`, `BudgetLineSpreadResponseTests.swift`, `BudgetDetailsCheckedProjectionTests.swift`, `dashboard-store.ts`, `dashboard-hero.ts`, les 4 records de la phase 5 |
| Unchecked     | none                                                                                                                                                     |
| Unplanned     | `phase-4.md` du plan lexical prend une 5e note d'écart et referme la note 4 (`CheckedToggle` porte le libellé du web) : hors des 4 tâches, dans l'objet de la phase |
