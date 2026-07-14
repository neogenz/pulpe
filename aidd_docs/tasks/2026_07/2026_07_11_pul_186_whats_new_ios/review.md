# Review: PUL-186 What's New iOS

- **Verdict**: approve
- **Diff**: `origin/preview...maximedesogus/pul-186-afficher-une-dialog-de-nouveautes-apres-mise-a-jour-ios`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_14
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Aligner le contrat et les données sur les versions iOS

- [x] Les releases iOS portent une `iosVersion` distincte de la version produit sans modifier le rendu landing — `landing/data/releases.json:20`, `backend-nest/src/modules/whats-new/releases-data.ts:45`
- [x] Le backend filtre dans l'espace `MARKETING_VERSION`, couvre `1.0.4 → 1.1.0`, les plages vides et valide le dataset complet — `backend-nest/src/modules/whats-new/whats-new-payload.ts:44`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:84`
- [x] Les releases produit partageant un même binaire iOS sont agrégées sous une seule version SwiftUI — `backend-nest/src/modules/whats-new/whats-new-payload.ts:45`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:130`
- [x] La procédure de release exige la version marketing, synchronise les deux copies et produit une projection iOS limitée aux éléments utiles — `.claude/skills/update-changelog/SKILL.md:236`, `.claude/skills/update-changelog/references/ios-release.md:12`

### Phase 2 — Fiabiliser migration, authentification et idempotence

- [x] Première installation, migration pré-PUL-186 et baseline `1.0.4` sont distinguées et testées — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:38`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:8`
- [x] Tout passage vers `.authenticated` déclenche uniquement le contrôle What's New ; le chargement métier initial reste dans `handleAppStart()` — `ios/Pulpe/App/RootViewModifiers.swift:150`, `ios/Pulpe/App/PulpeApp.swift:356`
- [x] Les contrôles concurrents ou pendant une présentation sont coalescés et l'événement n'est émis qu'à la présentation effective — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:32`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:129`
- [x] Réponse vide, erreur réseau et dismissal ont chacun une sémantique de marqueur explicite et testée — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:72`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:64`

### Phase 3 — Finaliser la présentation et prouver le parcours complet

- [x] Les dates valides sont localisées et la chaîne brute reste le fallback — `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:98`, `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:136`
- [x] Dynamic Type, scroll et action principale utilisent les composants et tokens existants — `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:13`, `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:44`
- [x] Les validations passent — `pnpm quality` 10/10, tests iOS 1681/1681, SwiftLint ciblé 0 violation, skill Claude/Codex valide
- [x] Le parcours réel affiche une seule sheet après authentification et persiste le dismissal — `ios/Pulpe/App/RootViewModifiers.swift:85`, `ios/Pulpe/Domain/Store/WhatsNewStore.swift:91`
- [x] Les six threads GitHub ouverts disposent d'une correction vérifiable dans le diff final — `backend-nest/src/modules/whats-new/whats-new-payload.ts:44`, `ios/Pulpe/Domain/Store/WhatsNewStore.swift:32`, `ios/Pulpe/Shared/Components/WhatsNewSheet.swift:136`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:164`, `.claude/skills/update-changelog/references/ios-release.md:36`, `ios/Pulpe/App/RootViewModifiers.swift:150`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (13/13) |
| Files checked | Plan phases, release skill/reference, changelog datasets, backend payload/controller/tests, iOS flags/store/lifecycle/sheet/tests, GitHub review threads |
| Unchecked | none |
| Unplanned | none |
