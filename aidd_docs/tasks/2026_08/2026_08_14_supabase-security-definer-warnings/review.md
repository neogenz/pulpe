# Review: Supabase SECURITY DEFINER warnings

- **Verdict**: approve
- **Diff**: `origin/preview...58a4e8b9fedb1de830f253bd4fa8163ef8171c55`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Fermer le point d'entrée legacy et figer le contrat ACL

- [x] Le catalogue fixe les 15 signatures et leurs ACL, refuse l'appel `authenticated` direct au legacy et conserve le wrapper courant; le guide reflète le point d'entrée utilisateur unique — `backend-nest/supabase/tests/security_definer_function_privileges.sql:7`, `backend-nest/supabase/tests/security_definer_function_privileges.sql:90`, `backend-nest/supabase/tests/security_definer_function_privileges.sql:207`, `docs/SAVINGS.md:437`

### Phase 2 — Basculer les RPC de pointage et de lecture vers RLS

- [x] Les quatre RPC sont invoker; le test authentifié prouve succès propriétaire et absence de mutation inter-tenant, complété par les intégrations ciblées livrées — `backend-nest/supabase/migrations/20260814121000_use_invoker_for_leaf_rpcs.sql:3`, `backend-nest/supabase/tests/budget_line_check_rpcs.sql:111`, `backend-nest/supabase/tests/budget_line_check_rpcs.sql:170`

### Phase 3 — Basculer les RPC atomiques de modèles et d'étalement vers RLS

- [x] Les trois signatures exactes passent invoker sans nouveau grant; les suites SQL et intégrations ciblées livrées couvrent atomicité, rollback et isolation, et le guide spread reflète RLS — `backend-nest/supabase/migrations/20260814122000_use_invoker_for_template_and_spread_rpcs.sql:4`, `backend-nest/supabase/tests/security_definer_function_privileges.sql:40`, `docs/SPREAD.md:48`, `docs/SPREAD.md:84`

### Phase 4 — Basculer les mutations d'objectifs compatibles et borner les exceptions

- [ ] Les deux mutations sont invoker, cinq definers durcis restent allowlistés et le reset frais accorde le DML administratif au `service_role`; l'Advisor production `15 → 5` reste un gate de release hors PR preview — `backend-nest/supabase/migrations/20260814123000_use_invoker_for_savings_goal_rpcs.sql:4`, `backend-nest/supabase/tests/security_definer_function_privileges.sql:100`, `backend-nest/supabase/tests/security_definer_function_privileges.sql:188`

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Verified      | 75% (3/4)                                                                                                                                                                                                                                                          |
| Files checked | `plan.md`, `phase-1.md`, `phase-2.md`, `phase-3.md`, `phase-4.md`, quatre migrations `2026081412*.sql`, `security_definer_function_privileges.sql`, `budget_line_check_rpcs.sql`, `README.md`, `docs/SAVINGS.md`, `docs/SPREAD.md`, fonctions/RLS/appels concernés |
| Unchecked     | Phase 4 — Advisor production `15 → 5` — not-applicable à la PR preview; gate de release explicitement conservé                                                                                                                                                     |
| Unplanned     | none                                                                                                                                                                                                                                                               |
