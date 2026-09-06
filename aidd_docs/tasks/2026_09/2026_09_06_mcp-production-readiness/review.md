# Review: MCP remediation and production readiness

- **Verdict**: changes-requested
- **Diff**: `a33f6c0583007ef4406482c41cd7534434bbebac...7c99f2b0a7939261db4af6174e77f38508f17424`
- **Axes run**: code, functional, relevancy
- **Date**: 2026-09-06
- **Findings**: 0 critical, 2 warning, 0 minor
- **Scope**: Incremental PR corrections and the production-readiness plan; static review, not a rerun of vendor acceptance or production approval. The two findings are outstanding readiness work, not newly identified runtime defects.

## Phases

### Phase 1 — Close readiness gaps and collect the launch decisions

- [ ] Close the current feature CI/review gate — **fix**: PR #725 remains open. CI and Android passed on `7c99f2b0a`; Claude API execution failed and is not approval. Complete the final documentation candidate's applicable checks and the authorized merge (`phase-1.md:36`).
- [x] Preserve promotion contracts that reject stale or ambiguous evidence without mutation — existing resolver coverage checks duplicate intentions, wrong identities and expired artifacts (`.github/scripts/resolve-release-state.test.mjs:173`, `.github/scripts/resolve-workflow-proof.test.mjs:191`); the plan reuses these mechanisms (`phase-1.md:37`).
- [ ] Complete one owner decision packet without publishing sensitive data — **fix**: target IDs and proposed operations are recorded, but upstream DCR/authorization-path settings, legacy issuance evidence, authenticated account scope and exact launch choices remain open (`phase-1.md:42`, `phase-1.md:45`).
- [x] Prevent readiness sign-off with unknown legacy issuance or unapproved operations — explicit activation and approval gates remain in the runbook and plan (`phase-1.md:44`, `plan.md:19`).

### Phase 2 — Prepare an exact, approved release candidate

- [ ] Agree product versions and four-language notes, then owner-merge one preparation PR — **not-applicable** to this unmerged feature snapshot; an explicitly pending phase, not an implemented release claim (`phase-2.md:47`).
- [ ] Bind a valid exact staging proof and immutable manifest to the tip of main — **not-applicable** before the preparation merge (`phase-2.md:54`).
- [ ] Verify repeated preparation creates no duplicate resource and leaves production unchanged — **not-applicable** until an actual release intention is prepared; static resolver contracts are covered in phase 1 (`phase-2.md:64`).

### Phase 3 — Deploy, activate and verify the approved MCP

- [ ] Finalize the exact production source and verify ordinary encrypted access before activation — **not-applicable** before the protected release, which this change does not execute (`phase-3.md:41`).
- [ ] Verify each claimed production client, credential boundary, cleanup and revocation — **not-applicable** before account-scope and activation approval; historical test evidence is not production evidence (`phase-3.md:48`).
- [ ] Prove incident containment without the old issuer, data loss or first-party key replacement — **not-applicable** to this static snapshot; recovery is specified, not executed (`phase-3.md:50`).
- [ ] Verify the production icon, disclosure and four-language availability claims — **not-applicable** before activation/listing work; vendor approval and untested surfaces remain qualified (`phase-3.md:54`).

## Findings

| Sev        | Kind       | Phase | Location                                                                    | Issue                                                                                                                                                            | Fix                                                                                                                                     |
| ---------- | ---------- | ----- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 warning | functional | 1     | `aidd_docs/tasks/2026_09/2026_09_06_mcp-production-readiness/phase-1.md:36` | Feature merge is pending; successful checks on the reviewed SHA do not cover subsequent documentation commits, and failed Claude execution supplies no approval. | Finish applicable final-SHA checks and review any findings before the authorized merge; do not bypass checks or relabel the failed run. |
| 🟡 warning | functional | 1     | `aidd_docs/tasks/2026_09/2026_09_06_mcp-production-readiness/phase-1.md:42` | The production decision packet lacks complete upstream/legacy evidence, authenticated baseline scope and exact owner launch decisions.                           | Complete the provider evidence and scoped decision packet, then obtain the applicable approvals before release or activation.           |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 18% (2/11 total criteria); 50% (2/4 current phase criteria). Seven criteria belong to explicitly pending later phases. This is not a production readiness percentage.                                                                                                                   |
| Files checked | All 37 changed files in the stated range: six readiness/verification documents, thirteen backend source/test/schema files, four locale catalogs and fourteen frontend source/test files; surrounding API, consent, cache, guard, persistence, route-scoping and promotion-test context. |
| Code          | No new actionable finding in the reviewed delta. Canonical audiences remain exact; failed activity recording does not turn completed writes into retryable failures; orphan cleanup preserves referenced clients.                                                                       |
| Relevancy     | No new finding. Existing API/cache and release mechanisms are reused; current owner vocabulary is Mensuel/Ponctuel; no calculator or native-source change is introduced by this range.                                                                                                  |
| Unchecked     | Phase 1 feature gate and owner decision packet — fix; all seven phase 2/3 criteria — not-applicable to this pre-release snapshot, still required at their execution gates.                                                                                                              |
| Unplanned     | Runtime/API/cache/i18n/retention corrections precede this readiness plan and trace to the owner-authorized PR findings; they are reviewed here as incremental code context, not represented as newly completed production phases.                                                       |
| Execution     | No tests, browser flows, deployment, secret change or runtime patch performed as part of this static review. Separate CI and read-only readiness observations are recorded in the cutover runbook.                                                                                      |
