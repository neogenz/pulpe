# Review: Correctifs PUL-186 What's New iOS

- **Verdict**: approve
- **Diff**: `9d177039eb20d10e88a65f1e63a13b4bfc57919d...96130aa5797f06675309d7a99e08ab641cc654d1`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_15
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Fermer les invariants de données et de release

- [x] Une projection backend sans `iosVersion` échoue au type-check — `backend-nest/src/modules/whats-new/releases-data.ts:6`
- [x] Une version sans note ou aux métadonnées invalides renvoie un feed vide tandis que le dataset projeté complet reste valide — `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:71`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:101`
- [x] La procédure de release autorise une version marketing sans note jusqu'à la synchronisation Railway — `.claude/skills/update-changelog/references/ios-release.md:71`
- [x] Lorsqu'une note existe, la procédure exige la même `iosVersion` dans les projections landing et backend — `.claude/skills/update-changelog/references/ios-release.md:73`

### Phase 2 — Aligner le flux backend et l'annulation iOS

- [x] L'endpoint authentifié conserve son payload en passant par le use-case enregistré par NestJS — `backend-nest/src/modules/whats-new/whats-new.controller.spec.ts:64`, `backend-nest/src/modules/whats-new/whats-new.module.ts:5`
- [x] Le contrôleur délègue au use-case sans appeler directement le builder métier — `backend-nest/src/modules/whats-new/whats-new.controller.ts:38`, `backend-nest/src/modules/whats-new/application/get-ios-whats-new.use-case.ts:5`
- [x] Les annulations Swift et URLSession quittent silencieusement sans présentation ni modification du marqueur — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:92`
- [x] Une erreur réseau réelle conserve le marqueur, ne présente rien et reste journalisée pour un retry — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:95`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:101`

### Phase 3 — Prouver le correctif et conclure la PR

- [x] Tests backend/iOS ciblés, architecture, SwiftLint et quality passent sur le commit `96130aa57` évalué par GitHub — PR `neogenz/pulpe#498`, checks `CI Success`, iOS, unitaires, intégration, E2E et quality verts
- [x] La PR est `MERGEABLE/CLEAN` face à la `preview` courante avec 24 checks réussis, 5 ignorés et aucun échec — GitHub PR `neogenz/pulpe#498`
- [x] Chaque discussion non obsolète contient une correction vérifiée ou une décision motivée ; aucun thread ne reste ouvert — GitHub PR `neogenz/pulpe#498`, 0 thread non résolu et non obsolète
- [x] La review finale conclut `approve` sans finding critique ni warning — `aidd_docs/tasks/2026_07/2026_07_15_pul_186_review_fixes/review.md:3`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (12/12) |
| Files checked | Plan et 3 phases, procédure iOS, données et payload What's New, use-case/controller/module NestJS, store/lifecycle/tests iOS, diff complet, checks et threads GitHub |
| Unchecked | none |
| Unplanned | none |
