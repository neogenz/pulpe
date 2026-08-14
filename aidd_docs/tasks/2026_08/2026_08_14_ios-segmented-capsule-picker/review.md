# Review: ios-segmented-capsule-picker

- **Verdict**: approve
- **Diff**: `preview...feat/ios-segmented-capsule-picker` (7e8dcc5e6)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

<!-- No plan.md: acceptance criteria are the session brief approved interactively (direction "track segmenté", portée "tous les 1-parmi-N"). -->

### Phase 1 — Track segmenté sur tous les sélecteurs 1-parmi-N

- [x] Atome partagé unique : track encastré `inputBackgroundSoft` + thumb `segmentedThumb` glissant (`matchedGeometryEffect`) — `ios/Pulpe/Shared/Components/CapsulePicker.swift:25-34,47-58`
- [x] Les 3 toggles deviennent des wrappers fins sur l'atome — `KindToggle.swift:7`, `SpreadModeToggle.swift:24`, `SpreadAmountModeToggle.swift:26`
- [x] Encre accent de la nature sur le segment actif — `KindToggle.swift:9`, `SpreadModeToggle.swift:26`, `SpreadAmountModeToggle.swift:28`
- [x] Chips d'action intactes (montants rapides, mois, PulpeChip) — hors diff
- [x] Mode sombre : le saut tonal du thumb porte le relief — `Color+Pulpe.swift` (`segmentedThumb`, light `.white` / dark `#4A4642`)
- [x] A11y conservée : traits `isSelected`, labels/valeurs conteneur, cible 44pt sur le Button, Reduce Motion — `CapsulePicker.swift:15,40,59-63`
- [x] Closures devise adaptées (`textOnPrimaryMuted` invisible sur thumb blanc) — `CurrencySettingView.swift:96`, `IncomeStep.swift:33`, `OnboardingStepView.swift:386`
- [x] Gates verts : build EXIT 0, SwiftLint strict 0, 52 tests / 5 suites passés

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 1 | `ios/Pulpe/Shared/Extensions/Color+Pulpe.swift:121` | `textOnPrimaryMuted` orphelin : ce diff retire ses 3 derniers usages | Supprimer le computed var |
| 🟢 | rot | 1 | `ios/Pulpe/Shared/Components/CurrencyAmountPicker.swift:23` | La capsule read-only garde le look pill hérité pendant que la variante interactive passe au track (pages Édition) | Aligner l'affichage read-only sur la nouvelle famille dans une passe ultérieure |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (8/8) |
| Files checked | CapsulePicker.swift, KindToggle.swift, SpreadModeToggle.swift, SpreadAmountModeToggle.swift, Color+Pulpe.swift, CurrencySettingView.swift, IncomeStep.swift, OnboardingStepView.swift, DESIGN.md, .swiftlint.yml |
| Unchecked     | none |
| Unplanned     | `ios/DESIGN.md` : reformatage prettier (lignes vides) — la baseline était déjà non conforme, le fichier l'est désormais |
