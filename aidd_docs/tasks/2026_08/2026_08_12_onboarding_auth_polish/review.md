# Review: onboarding auth polish

- **Verdict**: approve
- **Diff**: `HEAD...WORKTREE`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_12
- **Findings**: 0 critical, 0 warning, 1 minor resolved

## Phases

### Phase 1 — Center auth entry pages

- [x] The routed auth component occupies the shell width and centers its card — `frontend/projects/webapp/src/styles.scss:159`
- [x] The rule remains scoped to routed children of the existing entry shell — `frontend/projects/webapp/src/styles.scss:159`

### Phase 2 — Simplify account password creation

- [x] Signup asks for one password only — `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:152`
- [x] Password visibility, autofill, validation criteria, and form-boundary parsing remain — `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:154`
- [x] Signup schema and component tests cover the two-field account form — `frontend/projects/webapp/src/app/feature/auth/signup/signup-form.schema.spec.ts:10`, `frontend/projects/webapp/src/app/feature/auth/signup/signup.spec.ts:67`
- [x] PIN and password-reset confirmation flows are untouched — `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts:1`

### Phase 3 — Polish the mobile charges step

- [x] The optional-charge action uses compact mobile copy and full desktop copy — `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:510`, `frontend/projects/webapp/public/i18n/fr.json:1337`
- [x] Entering either onboarding substep resets the application viewport — `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:1081`, `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.spec.ts:134`
- [x] The sticky CTA has a non-interactive tonal fade that preserves the final content without motion — `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:810`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 minor | rot | 3 | `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts:1087` | `nextStep()` repeated the same step update and viewport reset already owned by `goToStep()`. | Resolved: `nextStep()` now calls `this.goToStep(2)`. |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (9/9) |
| Files checked | `frontend/projects/webapp/src/styles.scss`, `frontend/projects/webapp/src/app/feature/auth/signup/signup.ts`, `frontend/projects/webapp/src/app/feature/auth/signup/signup-form.schema.ts`, `frontend/projects/webapp/src/app/feature/auth/signup/signup.spec.ts`, `frontend/projects/webapp/src/app/feature/auth/signup/signup-form.schema.spec.ts`, `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.ts`, `frontend/projects/webapp/src/app/feature/complete-profile/complete-profile-page.spec.ts`, `frontend/projects/webapp/public/i18n/fr.json` |
| Unchecked     | none |
| Unplanned     | none |
