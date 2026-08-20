# Review: PUL-339 — sélecteur de langue iOS

- **Verdict**: changes-requested
- **Diff**: `47de54954009e5488364ecc1624761d4c6136e51...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_20
- **Findings**: 0 critical, 2 warnings, 1 minor — corrections appliquées, contrôle indépendant en attente

## Phases

### Phase 1 — Harmoniser et verrouiller le sélecteur de langue

- [x] Le scénario UI ouvre l’écran réel sans backend, expose les quatre choix natifs et confirme une sélection reproductible — `ios/Pulpe/App/PreferencesUITestHarness.swift:3`, `ios/PulpeUITests/LanguageSettingUITests.swift:18`
- [x] Le groupe utilise la surface commune et un `Menu + Picker` natif adaptatif; libellé, valeur, rôle, affordance unique et cibles minimales sont présents — `ios/Pulpe/Features/Account/LanguageSettingView.swift:29`, `ios/Pulpe/Features/Account/LanguageSettingView.swift:35`, `ios/PulpeUITests/LanguageSettingUITests.swift:68`
- [x] La matrice clair/sombre et Dynamic Type contrôle les collisions; la sélection conserve le flux de persistance, rollback et analytics existant — `ios/PulpeUITests/LanguageSettingUITests.swift:38`, `ios/Pulpe/Features/Account/LanguageSettingView.swift:75`, `ios/PulpeTests/Domain/Store/UserSettingsStoreTests.swift:123`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | conform | 1 | `ios/Pulpe/Features/Account/LanguageSettingView.swift:55`, `ios/Pulpe/Features/Account/LanguageSettingView.swift:111` | Les deux contrôles `.buttonStyle(.plain)` plaçaient leur `contentShape` dans le label, et le `Menu` plaçait aussi sa hauteur minimale dans le label. | Corrigé dans le working tree : hauteur minimale et `contentShape(Rectangle())` sont désormais portés par le `Menu` et le `Button`; contrôle indépendant en attente. |
| 🟡 warning | code | 1 | `ios/PulpeUITests/LanguageSettingUITests.swift:94` | Le teardown ignorait le résultat de `waitForExistence`, ce qui pouvait laisser la locale italienne sans faire échouer le test. | Corrigé dans le working tree : l’existence et la valeur française sont capturées, l’app est terminée, puis les assertions échouent si la restauration n’est pas confirmée; contrôle indépendant en attente. |
| 🟢 minor | rot | 1 | `aidd_docs/tasks/2026_08/2026_08_20_pul-339-ios-language-selector/phase-1.md:12` | La projection finale omettait `ios/Pulpe/Resources/Localizable.xcstrings`. | Corrigé dans le working tree : le catalogue figure dans la projection; contrôle indépendant en attente. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (3/3) |
| Files checked | `plan.md`, `phase-1.md`, `BudgetLongPressUITestHarness.swift`, `PreferencesUITestHarness.swift`, `PulpeApp.swift`, `SavingsGoalIntervalUITestHarness.swift`, `LanguageSettingView.swift`, `Localizable.xcstrings`, `LanguageSettingUITests.swift` |
| Unchecked     | none |
| Unplanned     | none |
