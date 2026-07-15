# Review: Correctifs PUL-186 What's New iOS

- **Verdict**: changes-requested
- **Diff**: `dd33fdc0a99b41e1334b8a1eafed11b6f588d201...e7fb29c4f6a938fbb7be434faf5b59f6b623f555`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_15
- **Findings**: 0 critical, 2 warning, 1 minor

## Phases

### Phase 1 — Fermer les invariants de données et de release

- [x] Une projection backend sans `iosVersion` échoue au type-check — `backend-nest/src/modules/whats-new/releases-data.ts:6`
- [x] Une version sans note ou avec des métadonnées invalides renvoie un feed vide tandis qu'une projection complète reste servie — `backend-nest/src/modules/whats-new/whats-new-payload.ts:40`, `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:71`
- [x] La procédure mène une version marketing sans note jusqu'à la synchronisation Railway — `.claude/skills/update-changelog/references/ios-release.md:71`
- [x] Lorsqu'une note existe, la procédure exige la même `iosVersion` dans les projections landing et backend — `.claude/skills/update-changelog/references/ios-release.md:73`

### Phase 2 — Aligner le flux backend et l'annulation iOS

- [x] L'endpoint authentifié conserve son payload en passant par le use-case enregistré par NestJS — `backend-nest/src/modules/whats-new/whats-new.controller.spec.ts:64`, `backend-nest/src/modules/whats-new/whats-new.module.ts:5`
- [x] Le contrôleur délègue au use-case sans appeler directement le builder — `backend-nest/src/modules/whats-new/whats-new.controller.ts:56`, `backend-nest/src/modules/whats-new/application/get-ios-whats-new.use-case.ts:7`
- [x] Les annulations Swift et URLSession quittent silencieusement sans présentation ni modification du marqueur — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:92`, `ios/Pulpe/Core/Network/APIError.swift:131`
- [x] Une erreur réseau conserve le marqueur, ne présente rien et reste journalisée pour un retry — `ios/Pulpe/Domain/Store/WhatsNewStore.swift:95`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:101`

### Phase 3 — Prouver le correctif et conclure la PR

- [x] Les tests backend/iOS, l'architecture et la quality ont passé sur le HEAD `e7fb29c4` évalué par GitHub — PR `neogenz/pulpe#498`, checks `CI Success`, iOS, unitaires, intégration, E2E et quality verts
- [ ] La PR n'est plus vérifiée face à la `preview` courante — branche basée sur `dd33fdc0`, `origin/preview` à `e9794ab7`, 116 commits d'écart et état GitHub `MERGEABLE/UNSTABLE`
- [x] Chaque discussion non obsolète contient une correction ou une décision motivée ; aucun thread actionnable ne reste ouvert — PR `neogenz/pulpe#498`, 0 thread non résolu et non obsolète
- [ ] La review finale ne peut pas conclure `approve` tant que la preuve d'intégration avec la cible courante manque — verdict `changes-requested`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟡 warning | functional | 3 | `aidd_docs/tasks/2026_07/2026_07_15_pul_186_review_fixes/phase-3.md:37,53` | Le HEAD a une CI applicative verte, mais elle a été produite avec la base PR `dd33fdc0`; `origin/preview` pointe maintenant sur `e9794ab7` et contient 116 commits absents de la branche. La compatibilité avec la cible actuelle n'est donc pas prouvée. | Rebaser la branche sur `origin/preview`, résoudre les chevauchements, puis laisser repasser les checks requis sur le nouveau HEAD. |
| 🟡 warning | functional | 3 | `aidd_docs/tasks/2026_07/2026_07_15_pul_186_review_fixes/phase-3.md:55` | Le critère exige une review finale `approve` sans warning, impossible tant que la synchronisation avec la cible courante reste ouverte. | Fermer le finding d'intégration, puis rejouer les trois axes de review sur le HEAD rebasé. |
| 🟢 minor | conform | 2 | `backend-nest/src/modules/whats-new/application/get-ios-whats-new.use-case.ts:3` | Le use-case dépend d'un builder racine qui importe Zod, et le contrôleur/DTO restent à la racine du module, alors que `backend-nest/docs/ARCHITECTURE.md:3-18,31-64` réserve ces éléments à `infrastructure/http` et interdit Zod dans la couche application. Le plan assume cet écart ciblé, donc il n'est pas bloquant à lui seul. | Lors d'un refactor dédié, placer le transport sous `infrastructure/http` et la projection derrière une frontière conforme, ou formaliser une exception de read-model dans un ADR. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 83% (10/12) |
| Files checked | Plan et 3 phases, diff complet, procédure de release, données landing/backend, schémas, use-case/controller/tests NestJS, lifecycle/store/sheet/tests iOS, règles d'architecture, checks et threads GitHub |
| Unchecked | Phase 3 — intégration avec la `preview` courante — fix ; Phase 3 — verdict final sans warning — fix |
| Unplanned | none |
