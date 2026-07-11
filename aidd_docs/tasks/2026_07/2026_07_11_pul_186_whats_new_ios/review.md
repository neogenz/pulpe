# Review: PUL-186 What's New iOS

- **Verdict**: blocked
- **Diff**: `preview...maximedesogus/pul-186-afficher-une-dialog-de-nouveautes-apres-mise-a-jour-ios`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_11
- **Findings**: 3 critical, 0 warning, 0 minor

## Phases

Not run: no implementation plan or acceptance-criteria artifact was provided.

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🔴 critical | fit | - | `ios/project.yml:40`, `backend-nest/src/modules/whats-new/releases-data.ts:27` | The running iOS app reports its independent marketing version (`1.1.0`), while every release-note entry is keyed by the product version (`0.18.0` through `0.37.1`). A real upgrade such as `1.0.4` to `1.1.0` therefore matches no backend entry and the sheet never appears. The iOS release rule explicitly says these version lines are independent. | Key/filter the feed with iOS marketing versions, or add an explicit product-release-to-iOS-version mapping and test the real `MARKETING_VERSION` range end to end. |
| 🔴 critical | fit | - | `ios/Pulpe/App/PulpeApp.swift:367` | `whatsNewStore.check()` runs only if startup finishes directly in `.authenticated`. Returning users commonly finish startup in `.needsPinEntry`, and signed-out users authenticate later; the existing auth-state change handler never invokes the check. Those normal upgrade paths never evaluate or present the dialog. | Trigger the one-shot check on the transition into `.authenticated` (with an idempotency guard), and add integration coverage for PIN unlock and login-after-launch. |
| 🔴 critical | fit | - | `ios/Pulpe/Domain/Store/WhatsNewStore.swift:28` | Absence of `pulpe.lastSeenWhatsNewVersion` is treated as a first install. Existing users upgrading from any build released before this feature also lack that key, so the rollout cannot distinguish them from fresh installs and silently marks the new version as seen. The first shipped update containing PUL-186 will show nothing to every existing user. | Seed/migrate from a previously persisted installed version, or introduce a rollout baseline that distinguishes pre-feature upgrades from a true first install; cover both cases separately. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | Not run |
| Files checked | `PRODUCT.md`, `DESIGN.md`, `ios/DESIGN.md`, iOS app lifecycle/store/service/sheet/tests, backend controller/payload/data/tests, shared schemas, release workflow/rules |
| Unchecked | Acceptance criteria unavailable — not-applicable |
| Unplanned | `.claude/skills/update-changelog/SKILL.md` and `.claude/rules/05-workflows-and-processes/posthog-events.md` updated to support the feature |
