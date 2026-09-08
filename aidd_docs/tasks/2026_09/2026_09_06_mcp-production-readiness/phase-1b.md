---
status: done
---

# Instruction: Repair the mobile release preparation

Maxime approved this recovery on 2026-09-08 after PR #727 revealed iPhone-only notes in the Android feed and Android run `34196047299` failed. Production remains untouched.

## Scope

- Reuse the existing per-entry platform filter in `whats-new-payload.ts`; do not add an item-filtering system or change the HTTP contract.
- Adjust `releases-data.parity.spec.ts`, the release validator and release curation instructions to accept disjoint mobile projections of one product release. Keep metadata anchoring, exact approved translations, unique per-platform projections and the iOS silence contract.
- Add a regression check proving that the two mobile feeds retain their own notes in all four locales.
- Diagnose the Android failure using the existing Preview test account and workflow. If more evidence is needed, emit only static flow/step identifiers and exit status. Never publish raw Maestro output, screenshots, credentials, PIN digits or account data; never weaken assertions or treat an unexplained failure as a pass.
- Fix a demonstrated Android cause within the existing application, test or workflow path, then require the exact corrective SHA to pass Android E2E before the replacement release.

## Verification and handoff

1. Run the complete What's New domain tests, the release validator against the existing release, and a fixture with separate iOS/Android projections. Reject overlapping platforms, out-of-scope metadata and localized copy drift.
2. Run the CI security contracts for any workflow change and the repository quality gate. Keep diagnostic traces private and failure propagation intact.
3. Commit the local correction and plan together on the normal feature branch. The completion marker certifies these local contracts, not a production or device acceptance result. The corrective PR and any evidence-led Android repair remain subject to normal CI and resolved reviews; phase 2 explicitly requires green Android E2E before proceeding.
4. In the fresh mechanical release, retain the three approved iOS notes and give Android only its approved planning note in FR/EN/DE/IT. Keep the complete public changelog and web toast unchanged.

## Acceptance criteria

- Existing historical feeds remain unchanged; separate projections preserve iOS notes and exclude them from Android.
- Validation accepts disjoint projections and rejects duplicate scopes or non-approved copy.
- Android diagnostics expose no account data, and every failed test still fails the workflow.
- Local targeted tests and quality pass; remote evidence is recorded separately and must be green before phase 2.

Local verification (2026-09-08): 35 What's New domain tests and 36 CI security tests pass, including simulated failures of all four Android flows without output disclosure. `pnpm quality`, `actionlint` and the release validator pass. CLI fixtures accept separate projections and Android alongside iOS silence, and reject duplicate scopes, foreign platforms, translation drift and iOS projection/silence overlap. Android device verification is still pending; this local completion does not certify run `34196047299` or permit release replacement before green E2E.
