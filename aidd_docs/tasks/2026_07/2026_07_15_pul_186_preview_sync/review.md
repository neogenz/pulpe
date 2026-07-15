# Review: Resynchronisation PUL-186 sur preview

- **Verdict**: approve
- **Diff**: `origin/preview...maximedesogus/pul-186-afficher-une-dialog-de-nouveautes-apres-mise-a-jour-ios`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_15
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 1 — Rebaser sur la preview courante

- [x] Le merge-base est la `preview` courante `e9794ab7`, avec zéro commit cible manquant — `git merge-base HEAD origin/preview`, `git rev-list --left-right --count origin/preview...HEAD` => `0 19`
- [x] Le rapport précédent et les fichiers du plan de synchronisation sont restaurés — `aidd_docs/tasks/2026_07/2026_07_15_pul_186_review_fixes/review.md:1`, `aidd_docs/tasks/2026_07/2026_07_15_pul_186_preview_sync/plan.md:1`
- [x] Les apports de preview et PUL-186 coexistent dans les sept fichiers chevauchants — `.gitignore:110`, `backend-nest/src/app.module.ts:37`, `ios/Pulpe/App/PulpeApp.swift:25`, `ios/Pulpe/Core/Analytics/AnalyticsEvent.swift:56`, `ios/Pulpe/Core/Network/Endpoints.swift:63`, `shared/index.ts:128`, `shared/schemas.ts:1697`
- [x] Le rebase ne perd ni ne duplique la feature — `git range-diff dd33fdc0..e7fb29c4 e9794ab7..9bd73474^` => 16 commits identiques et 1 adaptation contextuelle aux ajouts preview ; aucun marqueur de conflit ni changement local hors documents AIDD attendus

### Phase 2 — Revalider et conclure la PR

- [x] Les tests backend/iOS ciblés, `lint:arch`, SwiftLint ciblé et `pnpm quality` passent sur le même arbre source — backend `17 pass, 0 fail`, iOS `13 tests, 0 failed`, SwiftLint PUL-186 `0 violation`, quality `10/10`
- [x] Absence de note, métadonnée invalide, erreur réseau, annulation et dismissal restent fail-open — `backend-nest/src/modules/whats-new/whats-new-payload.spec.ts:71`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:64`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:101`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:114`, `ios/PulpeTests/Domain/Store/WhatsNewStoreTests.swift:127`
- [x] La publication a suivi l'autorisation explicite et un lease vérifié — accord utilisateur `vas y`, remote attendu `e7fb29c4`, push `--force-with-lease` vers `97c85854`
- [x] Le HEAD distant possède son agrégat `✅ CI Success` vert ; l'échec optionnel `claude-review` est une erreur d'automatisation sans finding — log `subtype success`, `is_error: true`, `No buffered inline comments`
- [x] La PR est `MERGEABLE`, cible `preview`, HEAD distant `97c85854`, merge-base `e9794ab7`, avec 0 thread non résolu et non obsolète — PR `neogenz/pulpe#498`
- [x] La review finale conclut `approve` avec zéro finding critique ou warning — `aidd_docs/tasks/2026_07/2026_07_15_pul_186_preview_sync/review.md:3`, `aidd_docs/tasks/2026_07/2026_07_15_pul_186_preview_sync/review.md:7`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 minor | conform | 1 | `backend-nest/src/modules/whats-new/application/get-ios-whats-new.use-case.ts:3` | Le use-case dépend transitivement de Zod via le builder racine et le transport reste hors `infrastructure/http`, contrairement à `backend-nest/docs/ARCHITECTURE.md`; `lint:arch` passe et le plan borne explicitement cet écart de read-model. | Lors d'un refactor dédié, déplacer le transport sous `infrastructure/http` et placer la projection derrière une frontière sans Zod, ou formaliser l'exception de read-model. |
| 🟢 minor | code | 1 | `.claude/skills/update-changelog/SKILL.md:102,316` | L'étape 4 ne résout la décision iOS que pour un changement user-facing, alors que l'étape 6 suppose une décision déjà confirmée pour tout changement sous `ios/**`; une release iOS technique doit relire le fallback `build` dans la référence. | Résoudre la décision pour tout changement iOS à l'étape 4, avec `build` proposé pour un changement non user-facing et inclus dans l'approbation. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (10/10) |
| Files checked | Plan et 2 phases, diff complet, règles projet/backend, skill de release et référence iOS, données landing/backend, payload/controller/tests NestJS, schémas partagés, flags/service/store/lifecycle/sheet/tests iOS, checks et threads GitHub |
| Unchecked | none |
| Unplanned | none |
