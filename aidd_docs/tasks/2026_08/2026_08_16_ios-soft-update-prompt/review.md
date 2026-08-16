# Review: proposer doucement les mises à jour iOS disponibles

- **Verdict**: approve
- **Diff**: `d85bd5536...8a098ebb2`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Ajouter le prompt doux iOS de bout en bout

- [x] Une version cible présentée est mémorisée à l'exposition, reste silencieuse après relance et seules les cibles strictement supérieures au high-water mark redeviennent éligibles — `ios/Pulpe/Domain/Store/AppVersionStore.swift:54`, `ios/PulpeTests/Domain/Store/AppVersionStoreTests.swift:39`
- [x] `minVersion` garde la priorité, l'échec initial reste fail-open et tout état confirmé survit à un échec ultérieur — `ios/Pulpe/Domain/Store/AppVersionStore.swift:46`, `ios/Pulpe/Domain/Store/AppVersionStore.swift:63`, `ios/PulpeTests/Domain/Store/AppVersionStoreTests.swift:101`
- [x] La sheet est réservée aux sessions authentifiées après le contrôle « Nouveau dans Pulpe », son CTA ouvre l'App Store et le statut exclusif garde le cover dur prioritaire — `ios/Pulpe/App/PulpeApp.swift:137`, `ios/Pulpe/App/PulpeApp.swift:178`, `ios/Pulpe/Domain/Store/WhatsNewStore.swift:20`, `ios/Pulpe/Features/ForceUpdate/UpdateAvailableSheet.swift:58`
- [x] L'apparition persiste la cible et le CTA, le bouton secondaire ainsi que le swipe convergent vers la même fermeture — `ios/Pulpe/App/PulpeApp.swift:140`, `ios/Pulpe/App/PulpeApp.swift:188`, `ios/Pulpe/Features/ForceUpdate/UpdateAvailableSheet.swift:53`
- [x] Le contrat et le runbook distinguent le seuil dur, la suggestion iOS, l'ignorance côté web et l'absence de rétroactivité pour la 1.0.0 — `backend-nest/src/modules/app-version/app-version.controller.ts:15`, `shared/schemas.ts:2495`, `docs/VERSIONING.md:90`
- [x] Les validations fournies confirment la compilation via 25/25 tests ciblés sur le device demandé, SwiftLint sans violation et les gates qualité/lexique verts — `ios/PulpeTests/Domain/Store/AppVersionStoreTests.swift:5`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:5`

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (6/6)                                                                                                                                                                                                                                                                                                                                                                            |
| Files checked | `plan.md`, `phase-1.md`, `app-version.controller.ts`, `VERSIONING.md`, `PulpeApp.swift`, `AppUpdateFlagsStore.swift`, `AppVersionService.swift`, `AppVersionStore.swift`, `WhatsNewStore.swift`, `UpdateAvailableSheet.swift`, `Localizable.xcstrings`, `AppVersionStoreTests.swift`, `WhatsNewStoreTests.swift`, `schemas.ts`, `RootViewModifiers.swift`, `I18N.md`, `ios/DESIGN.md` |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                                                                                  |
| Unplanned     | none                                                                                                                                                                                                                                                                                                                                                                                  |
