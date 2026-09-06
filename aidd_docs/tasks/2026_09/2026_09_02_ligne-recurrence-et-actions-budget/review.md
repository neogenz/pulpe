# Review: Récurrence sur la ligne et actions du détail budget

- **Verdict**: needs-work
- **Diff**: `origin/main...HEAD` + arbre de travail
- **Axes run**: code, functional, relevancy
- **Date**: 2026_09_03
- **Findings**: 0 critical, 2 warning, 2 minor

## Phases

### Phase 1 — Glyphe de récurrence sur le détail budget

- [x] Toute ligne du détail budget affiche un glyphe de récurrence en tête de sa ligne tertiaire, y compris celles qui n'avaient rien à dire — `BudgetLineMixedRow.swift:205`, garde supprimée ; consommé par `BudgetMixedSection.swift:75`
- [ ] Sur une ligne lissée avec objectif, le glyphe précède le texte existant et celui-ci reste lisible en taille standard — ordre correct, lisibilité toujours non observée : aucun rendu fidèle n'est possible en CLI ici
- [x] VoiceOver énonce « Récurrent » ou « Prévu » entre la nature et le nom, et n'énonce jamais le nom du symbole SF — `BudgetLineMixedRow+Accessibility.swift:20` et `.accessibilityHidden(true)` ligne 206
- [ ] Supprimer le glyphe ou le mot du label fait échouer `BudgetLinePresentationTests` — le mot oui, le glyphe non : aucun test n'observe l'`Image`

### Phase 2 — Glyphe de récurrence sur l'Accueil

- [x] `BudgetSection.swift` et `BudgetLineRow.swift` passent `swiftlint --strict` sans avertissement `file_length` — 251 et 256 lignes, lint vert
- [x] L'écran d'Accueil rend exactement comme avant l'extraction — l'extraction ne touche que `PreviousBudgetSheet` ; l'Accueil change par `UncheckedOperationsCard`
- [x] Une ligne consommée et une ligne vierge affichent toutes deux le glyphe, au même endroit — `BudgetLineRow.swift:130` (feuille mois précédent) et `UncheckedOperationsCard+Row.swift:66` (Accueil), inconditionnels
- [x] Aucun écran n'affiche plus les mots « Récurrent » ou « Prévu » sur une ligne de prévision de l'Accueil — `UncheckedOperationsCard+Copy.swift:17` s'arrête sur « Prévu ce mois » ; couvert par `UncheckedOperationRowCopyTests`
- [x] VoiceOver énonce toujours la récurrence sur les deux états — glyphe labellisé des deux côtés, la ligne à pointer combinant ses enfants
- [ ] Remettre le glyphe sous condition de `hasConsumption` fait échouer `BudgetLineRowPresentationTests` — les tests portent sur le texte, pas sur la structure de vue

### Phase 3 — « Hors prévision » sur les transactions libres

- [x] Aucun écran n'affiche la clé brute `Hors prévision` dans l'une des quatre langues — `Localizable.xcstrings` (fr source, de/en/it traduits)
- [x] Une transaction sans `budgetLineId` affiche « Hors prévision » dans Mouvements ; une transaction rattachée n'affiche rien — `ActivityCard.swift:180`, rendu par `CurrentMonthView.swift:329` ; couvert par `ActivityRowPresentationTests`
- [x] La section « Hors prévisions » du détail budget est inchangée, sans marqueur par ligne — `TransactionSection.swift` revenu à `origin/main`, donc ni `PreviousBudgetSheet` ni `LinkedTransactionsSheet` ne portent de marqueur
- [x] Retirer la condition `isFree` fait échouer `ActivityRowPresentationTests` — `ActivityRowPresentationTests.swift:11,18`

### Phase 4 — Actions du détail budget hors de la barre

- [ ] Les sept critères — phase non implémentée, `replan needed` : `ios/DESIGN.md` « Contextual creation » impose `topBarTrailing` pour le détail budget et `BudgetDetailsArchitectureTests.swift:282` l'exécute

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 | functional | 1 | `ios/Pulpe/Features/Budgets/BudgetDetails/BudgetLineMixedRow.swift:205` | Lisibilité de la ligne « Lissé · objectif X » toujours non vérifiée : le glyphe coûte ~17 pt à une ligne déjà pleine, et aucun rendu fidèle n'a pu être observé depuis la CLI. | Ouvrir la preview `BudgetLineMixedRow+Previews.swift` dans Xcode sur une ligne lissée + objectif, à 375 pt et en `xxLarge`. |
| 🟡 | functional | 1, 2 | `ios/PulpeTests/Features/Budgets/BudgetDetails/BudgetLinePresentationTests.swift:1` | Le critère « supprimer le glyphe fait échouer un test » reste non tenu sur les deux phases : les tests couvrent le texte et le label parlé, jamais la présence de l'`Image`. Sur l'Accueil c'est observable (la ligne combine ses enfants, donc `uncheckedRow.label` porte « Récurrent ») mais `ContextualCreationUITests` crashe aujourd'hui pour une raison étrangère à ce diff. | Ajouter l'assertion à `testFreshSignupHomeIsFilledAndSaysWhatIsMissing` une fois `AppVersionStore` réinjecté dans le harnais, ou réécrire le critère au replan. |
| 🟢 | rot | 2 | `ios/Pulpe/Features/CurrentMonth/Components/BudgetLineRow.swift:1` | `BudgetSection`, `BudgetLineRow` et `TransactionSection` vivent sous `Features/CurrentMonth/` alors que leurs consommateurs sont `Features/Budgets/BudgetDetails/` — dépendance `Features/X` → `Features/Y` interdite par `ios-architecture.md`. Antérieur à ce diff pour deux fichiers sur trois ; c'est ce nom de dossier qui a fait viser la mauvaise surface. | Déplacer les trois vers `Shared/Components/` en un seul mouvement, hors de cette tâche. |
| 🟢 | conform | 2 | `ios/Pulpe/Features/CurrentMonth/Components/UncheckedOperationsCard.swift:15` | `dynamicTypeSize` et `currency` passent de `private` à internal pour que `+Row.swift` les lise. Écart au tableau Access Control de `swift.md`, mais c'est le prix admis d'un split d'extension — `BudgetLineMixedRow+Amount.swift` expose ses membres de la même façon. | Rien à corriger ; la relaxation est commentée sur place. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 71% (12/17)                                       |
| Files checked | `BudgetLineMixedRow.swift`, `BudgetLineMixedRow+Accessibility.swift`, `BudgetLineRow.swift`, `BudgetSection.swift`, `ActivityCard.swift`, `UncheckedOperationsCard.swift`, `UncheckedOperationsCard+Row.swift`, `UncheckedOperationsCard+Copy.swift`, `Localizable.xcstrings` ; appelants vérifiés : `CurrentMonthView.swift`, `PreviousBudgetSheet.swift`, `LinkedTransactionsSheet.swift`, `BudgetMixedSection.swift`, `BudgetDetailsFreeTransactionsList.swift` |
| Unchecked     | P1 lisibilité ligne lissée — fix ; P1 et P2 glyphe non couvert par un test — fix ; P4 sept critères, une seule ligne `Findings` — replan |
| Unplanned     | `sensitiveAmount()` étendu au texte « sur X CHF » (`BudgetLineRow.swift:141`) : le montant prévu restait lisible en mode masqué alors que la colonne de droite floutait — assumé et déclaré au commit |
