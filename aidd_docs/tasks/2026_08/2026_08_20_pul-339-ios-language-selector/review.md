# Review: PUL-339 — sélecteur de langue iOS

- **Verdict**: approve
- **Diff**: `47de54954009e5488364ecc1624761d4c6136e51...fb759bb0467b8f2f29add0afc9c8e4cb36805a50`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_20
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Harmoniser et verrouiller le sélecteur de langue

- [x] Le scénario UI ouvre l’écran réel sans backend, expose les quatre choix natifs et confirme une sélection reproductible — `ios/Pulpe/App/PreferencesUITestHarness.swift:3`, `ios/PulpeUITests/LanguageSettingUITests.swift:18`
- [x] Le groupe utilise la surface commune et un `Menu + Picker` natif adaptatif; libellé, valeur, rôle, affordance unique et cibles minimales sont présents — `ios/Pulpe/Features/Account/LanguageSettingView.swift:29`, `ios/Pulpe/Features/Account/LanguageSettingView.swift:35`, `ios/PulpeUITests/LanguageSettingUITests.swift:68`
- [x] La matrice clair/sombre et Dynamic Type contrôle les collisions; la sélection conserve le flux de persistance, rollback et analytics existant — `ios/PulpeUITests/LanguageSettingUITests.swift:38`, `ios/Pulpe/Features/Account/LanguageSettingView.swift:76`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:123`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (3/3) |
| Files checked | `plan.md`, `phase-1.md`, `BudgetLongPressUITestHarness.swift`, `PreferencesUITestHarness.swift`, `PulpeApp.swift`, `SavingsGoalIntervalUITestHarness.swift`, `LanguageSettingView.swift`, `Localizable.xcstrings`, `LanguageSettingUITests.swift` |
| Unchecked     | none |
| Unplanned     | none |
