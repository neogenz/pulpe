# Review: ios-segmented-capsule-picker

- **Verdict**: approve
- **Diff**: `preview...feat/ios-segmented-capsule-picker` (settings-contrast fix included)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 1 minor

## Phases

<!-- No plan.md: acceptance criteria are the session brief approved interactively (direction retenue par Maxime sur visuels comparés : "pickers natifs", devise en segments texte). -->

### Phase 1 — Tous les sélecteurs 1-parmi-N sur le segmented control natif

- [x] Atome partagé unique : `SegmentedPicker` = wrapper fin sur `Picker(.segmented)` (titre optionnel + `.sensoryFeedback(.selection)`) — `ios/Pulpe/Shared/Components/SegmentedPicker.swift`
- [x] Les 3 toggles restent des wrappers fins, plomberie `accentColor` retirée (concession assumée : pas d'encre contextuelle sur le natif) — `KindToggle.swift`, `SpreadModeToggle.swift`, `SpreadAmountModeToggle.swift`, call sites `AddBudgetLineSheet.swift:136,139`
- [x] Devise corrigée : labels riches (drapeau + code + nom natif) → `Text` unique `🇨🇭 CHF` / `🇪🇺 EUR`; `UISegmentedControl` éclatait les vues composées en segments surnuméraires — `CurrencySettingView.swift`, `IncomeStep.swift`, `OnboardingStepView.swift`, `CurrencyAmountPicker.swift`
- [x] Code mort retiré : token `Color.segmentedThumb`, exclusion swiftlint `no_adhoc_capsule_chip` de l'atome, thumb/track custom (`matchedGeometryEffect`) — net −73 LOC
- [x] DESIGN.md § Segmented Choice réécrit pour le rendu natif (labels Text-only, concession encre documentée)
- [x] A11y : l'arbre expose désormais de vrais `SegmentedControl` nommés (« Nature », « Mode de création »); labels/valeurs des wrappers conservés
- [x] Gates verts : build EXIT 0, SwiftLint strict 0 sur les fichiers touchés, 2091 tests / 218 suites passés
- [x] Vérif visuelle sur simulateur : Devise (2 segments) et pile Nature / Lisser / Total (light) capturées et validées

### Phase 2 — Contraste des cartes réglages (demande Maxime en cours de branche)

- [x] Cause : `.listRowBackground(Color.surfaceContainerHigh)` (`#F0EDE9`) sur le canvas `appBackground` (`#EFF3EE`) ≈ 1.04:1 — violation de la règle DESIGN.md:346 (« never on the bare appBackground »)
- [x] Fix : famille réglages entière sur `Color.surfaceContainerLowest` (blanc / brun chaud `#1E1C1A`), même token que les cartes de lignes — `PreferencesView` ×3, `CurrencySettingView`, `TagsSettingsView` (remplacements) + `AccountView` ×4 et `SecuritySettingsView` ×2 (épinglés, remplaçant le blanc natif `secondarySystemGroupedBackground` pour une seule mécanique light+dark); la zone danger garde `destructiveBackground`, avatar et footer version gardent `.clear`
- [x] Les éléments blancs (thumb du segment natif, toggles) restent lisibles sur carte blanche : leur contraste vient de leurs tracks systemFill, pas de la carte — vérifié sur captures light + dark
- [x] Gates verts : build EXIT 0, SwiftLint strict 0 sur fichiers touchés, 2091 tests / 218 suites passés; captures light + dark validées sur simulateur

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | `ios/Pulpe/Shared/Components/CurrencyAmountPicker.swift` | La capsule read-only garde le look pill hérité pendant que la variante interactive passe au natif | Aligner l'affichage read-only dans une passe ultérieure |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (8/8) |
| Files checked | SegmentedPicker.swift, KindToggle.swift, SpreadModeToggle.swift, SpreadAmountModeToggle.swift, AddBudgetLineSheet.swift, Color+Pulpe.swift, CurrencySettingView.swift, IncomeStep.swift, OnboardingStepView.swift, CurrencyAmountPicker.swift, SavingsGoalFormSheet.swift, DESIGN.md, .swiftlint.yml |
| Unchecked     | none |
| Unplanned     | Renommage `CapsulePicker` → `SegmentedPicker` (le nom décrivait un mécanisme disparu); commentaires mis à jour dans `ActivityCard.swift` et `OnboardingSuggestionGrid.swift` |
