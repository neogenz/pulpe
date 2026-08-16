# Review: Empêcher la rotation dupliquée de recovery key

- **Verdict**: approve
- **Diff**: `origin/preview...5ee2b33b5`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_16
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Reproduire et corriger la double soumission en TDD

- [x] Le retry metadata reproduit le défaut historique avant correction puis interdit tout second setup ou regenerate — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:416`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:294`
- [x] La navigation différée garde le submit verrouillé jusqu'à sa résolution — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:439`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:333`
- [x] Après confirmation locale, un retry saute dérivation, setup, validation, régénération et dialogue pour reprendre à `updateUser` — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:294`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:310`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:326`
- [x] Deux appels concurrents restent single-flight avec une seule requête salt, une seule création et une seule modal — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:287`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:439`
- [x] Une instance fraîche conserve la reprise sûre `validate-key` puis `regenerate-recovery` et affiche la nouvelle clé — `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts:345`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts:460`

### Phase 2 — Verrouiller le parcours navigateur et documenter l'invariant

- [x] L'échec de metadata après confirmation mène au dashboard avec une seule clé affichée et zéro régénération — `frontend/e2e/tests/features/vault-code.spec.ts:147`, `frontend/e2e/tests/features/vault-code.spec.ts:217`
- [x] Les compteurs réseau vérifient explicitement un setup, zéro regenerate et deux mises à jour de metadata — `frontend/e2e/tests/features/vault-code.spec.ts:151`, `frontend/e2e/tests/features/vault-code.spec.ts:217`
- [x] La documentation distingue le retry local confirmé de la reprise fraîche et documente l'invalidation de la clé précédente — `docs/ENCRYPTION.md:161`
- [x] Les gates prévues terminent sans erreur : spec Angular 43/43, Playwright coffre 23/23, `pnpm quality` et build frontend/CSP — vérification locale du 2026_08_16

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (9/9 critères d'acceptation)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Files checked | `aidd_docs/tasks/2026_08/2026_08_16_prevent_duplicate_recovery_key_rotation/plan.md`, `aidd_docs/tasks/2026_08/2026_08_16_prevent_duplicate_recovery_key_rotation/phase-1.md`, `aidd_docs/tasks/2026_08/2026_08_16_prevent_duplicate_recovery_key_rotation/phase-2.md`, `docs/ENCRYPTION.md`, `frontend/e2e/tests/features/vault-code.spec.ts`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.spec.ts`, `frontend/projects/webapp/src/app/feature/auth/setup-vault-code/setup-vault-code.ts` |
| Unchecked     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Unplanned     | none                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Tests         | `setup-vault-code.spec.ts`: 43/43; `vault-code.spec.ts`: 23/23; `pnpm quality`: exit 0; `pnpm build:frontend`: exit 0 et contrôle CSP OK                                                                                                                                                                                                                                                                                                                                                                                        |
