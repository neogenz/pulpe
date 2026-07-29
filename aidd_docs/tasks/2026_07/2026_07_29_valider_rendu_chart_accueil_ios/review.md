# Review: Valider le rendu du chart de l’accueil iOS

- **Verdict**: changes-requested
- **Diff**: `6e57b8978...d7be88e0b`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_29
- **Findings**: 0 critical, 2 warnings, 0 minor

## Phases

### Phase 1 — Prouver la matrice visuelle du chart

- [x] Les trajectoires civile et décalée sont déterministes, utilisent la formule de production et ne dépendent ni de la date d’exécution, ni du réseau, ni d’un compte connecté — `ios/Pulpe/App/ContextualCreationUITestHarness.swift:143`, `ios/Pulpe/App/ContextualCreationUITestHarness.swift:200`
- [x] Sans le mode chart, les deux tests de création contextuelle conservent leur parcours — `ios/Pulpe/App/ContextualCreationUITestHarness.swift:108`, `ios/PulpeUITests/ContextualCreationUITests.swift:12`, `ios/PulpeUITests/ContextualCreationUITests.swift:25`
- [x] Le test parcourt huit variantes et conserve une capture nommée pour chacune avec `keepAlways` — `ios/PulpeUITests/ContextualCreationUITests.swift:41`, `ios/PulpeUITests/ContextualCreationUITests.swift:54`, `ios/PulpeUITests/ContextualCreationUITests.swift:98`
- [ ] La validation s’exécute en série sur un simulateur explicitement ciblé sans modifier son apparence globale — le thème est local à la vue, mais le ciblage du simulateur et les options d’exécution ne figurent pas dans le diff — not-applicable
- [ ] Les trois annotations sont effectivement rendues sur les huit captures sans collision ni troncature — le test attend seulement le bouton du hero et peut réussir sans trajectoire ni chart — fix
- [x] Lorsque la destination égale le prévu, les deux annotations utilisent des voies verticales distinctes dans les deux politiques de taille — `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:314`, `ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTests.swift:260`
- [x] La courbe, le connecteur pointillé, les deux marqueurs, le masquage et le résumé VoiceOver restent présents — `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:185`, `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:200`, `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:232`, `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:246`, `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:274`, `ios/PulpeTests/Features/CurrentMonth/HomeHeroCardTests.swift:195`
- [ ] Le test UI ciblé, `HomeHeroCardTests`, le build `PulpeLocal` et SwiftLint réussissent — résultats d’exécution absents du diff statique — not-applicable

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | code | 1 | `ios/Pulpe/App/ContextualCreationUITestHarness.swift:200`, `ios/Pulpe/App/ContextualCreationUITestHarness.swift:248`, `ios/PulpeUITests/ContextualCreationUITests.swift:52` | La trajectoire de fixture reste optionnelle et le test attend un bouton indépendant du chart. Si la formule renvoie `nil` ou si le chart cesse d’être rendu, les huit captures sont tout de même jointes et le test passe. | Exiger une trajectoire non optionnelle dans le harness et attendre un identifiant stable porté par le chart avant chaque capture. |
| 🟡 warning | conform | 1 | `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:180`, `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:227`, `ios/Pulpe/Features/CurrentMonth/Components/HomeHeroCard.swift:262` | Les trois annotations plafonnent Dynamic Type à `.xxxLarge` lorsque le scénario demande `.accessibility3`. Cela masque les collisions en réduisant la taille demandée et contredit la règle iOS imposant Dynamic Type sur les labels du hero. | Préserver la taille d’accessibilité demandée et résoudre la matrice uniquement par la position, l’alignement ou les libellés de `ChartAnnotationLayout`. |

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 75% (6/8) |
| Files checked | `plan.md`, `phase-1.md`, `PRODUCT.md`, `DESIGN.md`, `ios/DESIGN.md`, `ContextualCreationUITestHarness.swift`, `ContextualCreationUITests.swift`, `BalanceTrajectory.swift`, `CurrentMonthStore.swift`, `HomeHeroCard.swift`, `HomeHeroCardTests.swift`, diff complet |
| Unchecked     | Phase 1 — ciblage/exécution du simulateur — not-applicable; Phase 1 — présence réelle du chart dans les huit captures — fix; Phase 1 — résultats build/tests/lint — not-applicable |
| Unplanned     | none — les changements antérieurs de l’accueil et de la navigation sont tracés dans leurs plans AIDD frères |
