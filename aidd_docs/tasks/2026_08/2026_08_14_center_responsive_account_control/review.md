# Review: Center responsive account control

- **Verdict**: approve
- **Diff**: `origin/preview...f05eabfe9829476394f3f3f9bed1668cb591d13c`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Recentrer et verrouiller le contrôle de compte

- [x] The responsive account avatar and email share the account control's vertical center — `frontend/projects/webapp/src/app/layout/main-layout.ts:370`, `frontend/e2e/tests/features/mobile-scroll.spec.ts:222`
- [x] Material hover, focus, pressed, touch-target, truncation, and menu behavior remain owned by the unchanged Material button while the projected content is locally centered — `frontend/projects/webapp/src/app/layout/main-layout.ts:356`, `frontend/e2e/tests/features/mobile-scroll.spec.ts:225`
- [x] The handset browser check fails above a one-CSS-pixel center delta, independent of device pixel ratio — `frontend/e2e/tests/features/mobile-scroll.spec.ts:222`

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% (3/3)                                                                                                                                                                                                                                                                       |
| Files checked | `aidd_docs/tasks/2026_08/2026_08_14_center_responsive_account_control/plan.md`, `aidd_docs/tasks/2026_08/2026_08_14_center_responsive_account_control/phase-1.md`, `frontend/projects/webapp/src/app/layout/main-layout.ts`, `frontend/e2e/tests/features/mobile-scroll.spec.ts` |
| Unchecked     | none                                                                                                                                                                                                                                                                             |
| Unplanned     | none                                                                                                                                                                                                                                                                             |
