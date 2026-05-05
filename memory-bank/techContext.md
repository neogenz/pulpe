# Pulpe - Technical Context & Decision Records

> Technical decisions + stack details. MADR (Markdown Any Decision Records) 2026 standard.

---

## Tech Stack Overview

| Layer | Technology |
|-------|------------|
| Frontend | Angular 21+, Signals, Material 21, Tailwind v4 |
| Backend | NestJS 11+, Bun runtime |
| iOS | SwiftUI, Swift 6, Xcode 26+, XcodeGen |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Shared | TypeScript strict, Zod schemas |
| Orchestration | pnpm workspaces + Turborepo |

---

## Decisions

| ID | Title | Date |
|----|-------|------|
| DR-001 | Backend-First Demo Mode | 2025-06-15 |
| DR-002 | Automated Demo Cleanup | 2025-06-15 |
| DR-003 | Remove Variable Transaction Recurrence | 2025-07-20 |
| DR-004 | Typed & Versioned Storage Service | 2025-11-10 |
| DR-005 | Temp ID Replacement Before Toggle Cascade | 2026-01-30 |
| DR-006 | Split-Key Encryption for Financial Amounts | 2026-01-29 |
| DR-007 | Zoneless Testing — Child Input Signal Limitation | 2026-02-13 |
| DR-008 | Centralized ApiClient with Mandatory Zod Validation | 2026-02-13 |
| DR-009 | Signal Store Pattern with SWR | 2026-02-13 |
| DR-010 | Greenlight Preflight & FormTextField `hint:` Rename | 2026-03-16 |
| DR-011 | iOS Swift 6 Migration & Build Optimization | 2026-03-31 |
| DR-012 | VariableBlur for Progressive Blur Effects | 2026-04-10 |
| DR-013 | Onboarding Step Visibility & Apple App Store Compliance | 2026-04-12 |
| DR-014 | Multi-Currency with Conversion Metadata | 2026-03-06 |
| DR-015 | Feature Flags via PostHog with Early Adopter Targeting | 2026-04-12 |
| DR-016 | API Date Semantics — UTC Instants vs Business Calendar (Europe/Zurich) | 2026-04-15 |

---

## DR-013: Onboarding Step Visibility & Apple App Store Compliance

**Date**: 2026-04-12

### Problem

Apple rejected app — asked firstName to user auth'd via Apple Sign In when provider already gave it. Beyond ponctual fix, onboarding had multiple divergent paths (social vs email) with own skip logic — fragile, hard maintain, progression counter "X/Y" showed numbers inconsistent with actual steps seen. Email path ended on RegistrationStep (heavy form) instead of BudgetPreview (peak-end), broke emotional arc.

### Decision Drivers

- App Store: rejection guaranteed if collect data already provided by social SDK
- Progression counter must match exactly what user sees (no "5/7" for someone doing 4 steps)
- Social + email converge same point functionally (budget creation = finale) — path divergence artificial
- Future-proof: if add conditional steps (KYC, legal docs, A/B variants), pattern must scale no skip logic dup
- Peak-end rule: experience must end on budget celebration, not credentials form

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Skip ad-hoc inline (`if isSocial && hasName { skipFirstName }` dans `nextStep()`) | Rejected — dup logic forward/backward + counter + tests, fragile each add |
| B | Visibility-driven step filter (`isStepVisible(_:)` central + `nextVisibleStep`/`previousVisibleStep` helpers) | Chosen |
| C | Two separate flows (`SocialOnboardingFlow` vs `EmailOnboardingFlow`) | Rejected — over-engineering, breaks BudgetPreview edit round-trip, dup financial steps |

### Decision

1. **`isStepVisible(_:)`** central on `OnboardingState` determines step visibility from auth state: welcome always visible; `firstName` hidden for social-with-name; `registration` hidden once auth'd; rest always visible
2. **`nextVisibleStep(after:)` / `previousVisibleStep(before:)`** private helpers consumed by `nextStep()` / `previousStep()` — single skip mechanism, no special cases
3. **`progressBarSteps: [OnboardingStep]`** computed fed to `OnboardingProgressIndicator` → counter shows exactly steps truly seen (4/4 social-with-name, 5/5 social-private-relay, 6/6 email)
4. **Unified auth model**: `authenticatedUser` + `readyToComplete` replace `socialUser` + `readyForSocialCompletion`. Both paths converge to `finishOnboarding()` triggered from BudgetPreview as unique finale
5. **`socialProvidedName`** stable flag (set once in `configureSocialUser`) — visibility no shift while user types name in firstName
6. **Implicit consent**: CGU checkbox removed, inline disclosure (`OnboardingConsentText` shared component) covers social AND email
7. **Cold-start session recovery** via `wasEmailRegistered` flag persisted in `OnboardingStorageData` + `AuthService.validateSession()` at mount

### Rationale

- Option A fix Apple rejection but leaves dup between forward/backward + counter + tests — each future constraint adds new skip pair to maintain
- Option B unifies everything: single visibility predicate, nav helpers + counter derive from it. Add future constraint = single `case` in `isStepVisible(_:)`
- Option C breaks `editReturnStep` round-trip (two struct types no share observable state) + dup all financial step code
- `socialProvidedName` must be stable flag (not computed from `firstName.isEmpty`) else visibility shifts when user types → counter shifts mid-flow → confusion
- Email path no need different finale from social path: BudgetPreview legit celebration both

### Consequences

- **Positive**: App Store rejection resolved; honest counter all paths; single code path to add conditional steps future
- **Positive**: Both paths converge BudgetPreview as finale → peak-end rule respected all users (last thing seen before PIN setup = budget, not form)
- **Positive**: `editReturnStep` round-trip works on unified path no branching (user can edit Revenus/Charges/Épargne from BudgetPreview + return auto)
- **Trade-off**: Implicit inline consent (`OnboardingConsentText`) instead of explicit checkbox — covers social AND email but watch if regulation change (GDPR, FADP Swiss). Marketing/legal docs must reflect pattern
- **Trade-off**: Cold-start email recovery depends on `AuthService.validateSession()` at flow `.task` — silently expired session resets user to `.welcome` (acceptable, but know it during debug)
- **Impact**: `OnboardingState.swift` (visibility helpers + unified auth state), `OnboardingStep.swift` (enum extracted for SwiftLint file-length), `OnboardingFlow.swift` (consume `progressBarSteps` + cold-start recovery), `OnboardingProgressIndicator.swift` (interface refactor: `progressSteps: [OnboardingStep]` instead of `totalSteps: Int`), all `Steps/*.swift` (alignment), `OnboardingConsentText.swift` (new shared component)

### Notes

- **Rule future onboarding work**: if add conditional step, add case in `isStepVisible(_:)` — **NEVER** skip inline in `nextStep()` / `previousStep()`. Visibility pattern scales.
- **Apple App Store rule**: **NEVER** ask data that social provider already gives (firstName, email, photo). Systematically test Apple Sign In path with account sharing full name before submission.
- Visibility pattern extensible: KYC, legal docs, payment steps, A/B test variants — all can become conditional via same mechanism no nav touch
- `OnboardingStep` enum extracted to own file (`OnboardingStep.swift`) to pass SwiftLint `file_length` limit on `OnboardingState.swift` post-refactor
- Implementation: commits `5e5b24b33` (unification refactor), `d70509497` (polish + lighter form), `a7c557e46` (clean code follow-up)

---

## DR-015: Feature Flags via PostHog with Early Adopter Targeting

**Date**: 2026-04-12

### Problem

Multi-currency (PUL-99 / DR-014) introduces significant opt-in feature (CHF/EUR with conversion metadata persistence). Shipping directly to 100% users = risks:

1. **No kill switch**: if bug hits prod, must redeploy to rollback
2. **No progressive rollout**: impossible test feature real conditions with user subset before global exposure
3. **No cohort mechanism**: no way to target "early adopters" for early access

No feature flag existed in project — first flag introduced, must serve as reusable template.

### Decision Drivers

- PostHog already instrumented webapp + iOS for analytics — native feature flags integration, no extra tool
- Supabase metadata `app_metadata.early_adopter` already existed (read in `auth-store.ts`) but not sent to PostHog
- Multi-currency UX gating touches ~14 forms + settings + onboarding — centralization critical to avoid massive tech debt
- Must reuse for future gated features (savings goals, notifications, etc.)

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: PostHog feature flags | Already instrumented, targeting via person properties, dashboard-only rollout | Chosen |
| B: LaunchDarkly / Statsig | Dedicated tools, more features | Rejected — new tool to integrate, extra cost, no incremental value vs PostHog for project size |
| C: Static toggle config (env var / shared constant) | No SDK, simple recompiled bool | Rejected — no progressive rollout, no per-user targeting, requires deploy each change |
| D: Supabase RLS-based gating | Filter currency columns backend from `app_metadata.early_adopter` | Rejected — backend/UI flag coupling, complex rollback, perf degraded |

### Decision

1. **PostHog feature flags** with single source of truth in `shared/src/feature-flags.ts`:
   - `FEATURE_FLAGS.MULTI_CURRENCY = 'multi-currency-enabled'`
   - `ANALYTICS_PROPERTIES.EARLY_ADOPTER = 'early_adopter'`
   - iOS manual mirror via `AnalyticsService.earlyAdopterProperty` (explicit sync comment)

2. **Targeting by person property**: `early_adopter` sent to PostHog via `identify()` each login (reads `app_metadata.early_adopter` Supabase)

3. **Reactive pattern per platform**:
   - **Frontend**: `PostHogService.isFeatureEnabled()` + signal `flagsVersion` bumped via `posthog.onFeatureFlags(callback)`. `FeatureFlagsService.isMultiCurrencyEnabled` = `computed()` reads `flagsVersion` for reactivity. Angular templates with `@if (isMultiCurrencyEnabled())`.
   - **iOS**: `AnalyticsService.isFeatureEnabled()` + `FeatureFlagsStore` (`@Observable @MainActor`) with UserDefaults persistence to avoid boot flicker. Refresh on identify (post-login) + `scenePhase = .active` (foreground).

4. **Centralized gating on 2 entry points** (transparent for ~14 forms):
   - Frontend: `injectCurrencyFormConfig()` returns `showCurrencySelector` computed gated by flag
   - iOS: `UserSettingsStore.showCurrencySelectorEffective` (flag && user toggle) — 6 sheets rename their reference

5. **3-phase rollout strategy** (industry-standard pattern):
   - **Phase 1**: targeted `early_adopter = true` (dashboard-only)
   - **Phase 2**: `100% of all users` (dashboard-only, kill switch still active)
   - **Phase 3**: dedicated PR `chore: remove multi-currency feature flag` after stabilization (~6 weeks), find/replace + flag removal from code + PostHog archival

### Rationale

- **Zero deploy for rollout**: phases 1 + 2 are 100% dashboard-only — Product/Eng Lead can tune no code touch
- **Reusable pattern**: next gated feature just adds constant in `FEATURE_FLAGS` + computed in `FeatureFlagsService` / `FeatureFlagsStore`
- **Backend untouched**: currency endpoints remain open, schemas still accept metadata. If rollback flag after users created EUR transactions, data stays readable (degraded display no badge but amount intact)
- **Tech debt hygiene**: phase 3 explicitly planned + tracked in PUL-99. Temp flags must die — difference between "temp feature flag" (good) + "permanent toggle" (debt)
- **No race condition at boot**: `posthog.onFeatureFlags()` registered immediately after `posthog.init()` synchronously. Default `false` when flags not yet resolved = safe (feature hidden, not revealed)
- **Person property vs cohort**: person property more dynamic (can change for existing user via SQL) than static cohort, already in Supabase

### Consequences

- **Positive**:
  - Progressive rollout possible no deploy (phases 1 + 2 dashboard-only)
  - Instant kill switch via PostHog dashboard
  - Auto `$feature_flag_called` metrics to track who has feature
  - Pattern documented for future flags
  - 4 iOS previews rendering `CurrencyConversionBadge` received `.environment(FeatureFlagsStore())` to avoid crashes (env-based gating)
- **Trade-off**:
  - `flagsVersion` signal bump invalidates ALL flag-dependent computeds simultaneously. Acceptable at 1 flag, monitor if >10+ active flags (consider per-flag signals)
  - iOS `FeatureFlagsStore.refresh()` runs each `scenePhase = .active` — light network overhead (one PostHog call per foreground)
  - Phase 1/2 code contains `@if (isMultiCurrencyEnabled())` that must disappear phase 3 to avoid debt
- **Impact**: 32 files in commit `e74efa1ad`. New: `shared/src/feature-flags.ts`, `frontend/projects/webapp/src/app/core/feature-flags/`, `ios/Pulpe/Domain/Store/FeatureFlagsStore.swift`. Extended: `PostHogService` (frontend), `AnalyticsService` (iOS), `analytics.ts` + `auth-store.ts` (frontend), `AppState+Auth.swift` + `AuthService.swift` (iOS), `UserSettingsStore` (iOS), `PulpeApp.swift`

### Notes

- **Local flag test**:
  - Webapp: `localStorage.setItem('phc_<projectKey>_feature_flags', '{"multi-currency-enabled": true}')` then reload
  - iOS: use account with `app_metadata.early_adopter = true` or temp override in `FeatureFlagsStore.refresh()`
- **Tag user early adopter via Supabase**:
  ```sql
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data, '{}'), '{early_adopter}', 'true')
  WHERE email = 'user@example.com';
  ```
  User must reconnect for new value to be sent to PostHog via `identify()`
- **Full operational reference**: ticket PUL-99 contains detailed Phase 1/2/3 runbook with exhaustive file list to delete on clean removal

---

## DR-016: API Date Semantics — UTC Instants vs Business Calendar (Europe/Zurich)

**Date**: 2026-04-15

### Problem

Backend mixes two notions no naming: **instants** (timestamps) + **civil business days** (no hour), notably for exchange rates (Frankfurter returns `date` in `YYYY-MM-DD` format). Patterns like `toISOString().slice(0, 10)` or `Intl` workarounds + exotic locale (`en-CA`, `sv-SE`) hide intent + can confuse **UTC date** and **calendar day in a timezone**.

### Decision Drivers

- **Standards 2025–2026**: for **instant**, prefer **ISO 8601 UTC** (`…Z`). For **business date-only**, **`YYYY-MM-DD`** string appropriate — **not** an instant; forcing "UTC" via UTC midnight misleading.
- **Pulpe product**: CH users, ECB/Frankfurter rates described as **publication day**; fallback "today" if API omits `date` must be **business-coherent** (CH timezone), no opaque trick.
- **Stack**: `date-fns` v4 already backend dep; official doc recommends **`@date-fns/tz`** for IANA calculations/format (`format(…, { in: tz(zone) })`), vs old third-party `date-fns-tz` alone or `Intl` hacks.

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A | Always UTC: `toISOString()` / UTC midnight for all | Rejected for **business date-only** — false precision, midnight bugs |
| B | `Intl` + locale to get `YYYY-MM-DD` no dep | Rejected as **default pattern** — low intent readability |
| C | `date-fns` + `@date-fns/tz`, explicit IANA timezone for business days | Chosen |
| D | Add `Luxon` alongside `date-fns` | Rejected — useless duplicate while date-fns covers need |

### Decision

1. **Instants** (`createdAt`, `updatedAt`, deadlines with hour, logs): stay **UTC**, **ISO 8601** serialization with `Z` or explicit offset (usual API convention).

2. **Civil business days** (ex: day associated with exchange rate, fallback if `date` absent in Frankfurter response):
   - Format: **`YYYY-MM-DD`**
   - Default timezone: **`Europe/Zurich`** (aligned CH users / DR-014)
   - Centralized impl: `backend-nest/src/common/utils/business-calendar-date.ts` — `formatBusinessCalendarDate()` uses `date-fns` `format` with `{ in: tz(timeZone) }` from `@date-fns/tz`.

3. **Source of truth**: when external API provides `date` (ex: Frankfurter), **use as-is**; CH timezone only replaces **server-built fallbacks**.

4. **Evolution**: if multi-region needed, read `APP_BUSINESS_TIMEZONE` (or equivalent) via `ConfigService` + pass to `formatBusinessCalendarDate` instead of single constant.

### Rationale

- **Instant vs date-only** distinction = same distinction as common API best practices (avoid serializing business date as artificial UTC datetime).
- **`@date-fns/tz`** = documented path with **date-fns v4**; small dep + clear intent vs `Intl` + locale.
- **Europe/Zurich** for fallback = coherent with Pulpe domain without forcing timezone on all datetime fields.

### Consequences

- **Positive**: explicit intent in code, unit tests on calendar util, multi-currency alignment (DR-014).
- **Trade-off**: one more dep (`@date-fns/tz`) — acceptable + officially coupled with date-fns v4.
- **Impact**: `backend-nest/package.json`, `business-calendar-date.ts`, consumers (ex: `CurrencyService` for `date` date-only fields / fallback).

### Notes

- Don't use `formatBusinessCalendarDate` for **timestamps**; for those cases, prefer UTC + full ISO.
- Quick community ref: date-fns v4 blog "first-class time zones" + `@date-fns/tz` package.

---

## DR-012: VariableBlur for Progressive Blur Effects

**Date**: 2026-04-10

### Problem

Onboarding + login screens use gradient background (`loginGradientBackground`: green → dark). `LinearGradient` fade to fixed color never matches background at all positions. `.ultraThinMaterial` masked by gradient creates visible grayish band on dark background. No SwiftUI public API allows variable-radius blur (gaussian fading max → 0).

### Decision Drivers

- Background = multi-color gradient — monochrome fade always creates visible mismatch
- `.ultraThinMaterial` + gradient mask tested + rejected — ugly render dark background (visible frosted band)
- Apple uses same private API (`CAFilter` gaussian variable sigma) in Music, Photos, Safari
- [nikstar/VariableBlur](https://github.com/nikstar/VariableBlur) package (500+ stars) exposes this API

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: LinearGradient color fade | Gradient to `onboardingFormBase` | Rejected — mismatch on gradient background |
| B: `.ultraThinMaterial` + gradient mask | Masked material blur | Rejected — visible frosted band on dark background |
| C: VariableBlur (private API) | Real gaussian variable-radius blur | Chosen — only visually correct solution |
| D: No blur | Simple content clipping | Rejected — inferior UX |

### Decision

Add `nikstar/VariableBlur` v1.3.0 as SPM dependency. Wrapper in `ProgressiveBlurEdge` (shared component in `Shared/Components/`) used on:
- **Login**: top overlay with `.ignoresSafeArea(edges: .top)` to cover Dynamic Island
- **Onboarding**: bottom overlay with `.ignoresSafeArea(edges: .bottom)` under floating button
- **Onboarding top**: keeps simple `LinearGradient` (background at that level already close to `onboardingFormBase`)

### Rationale

- `VariableBlurView` changes blur **radius** (max → 0), not opacity of fixed material — visually invisible transition regardless of background
- Private API (`CAFilter`) but identical to what Apple uses in own apps — App Store approved to date
- Light package (~200 lines), no transitive deps, iOS 13+
- Public SwiftUI alternatives all tested + rejected for concrete visual reasons

### Consequences

- **Positive**: Native progressive blur on any background (gradient, image, color)
- **Risk**: Private API — Apple could block `CAFilter` in App Store review. Package used in production by many apps no known rejection, but risk exists.
- **Fallback**: If rejected, revert to `LinearGradient` color fade (already implemented as alternative on top onboarding)
- **Impact**: `project.yml` (new dep), `ProgressiveBlurEdge.swift`, `OnboardingFlow.swift`, `LoginView.swift`

### Notes

- **iOS 26 introduced `scrollEdgeEffectStyle(.soft, for: .bottom)`** — native API doing exact same job (blur + dim scroll edges, auto safe area + keyboard handling). Consider migration with `@available(iOS 26, *)` when deployment target allows.
- **Critical modifier ordering**: `.ignoresSafeArea(edges:)` must be applied BEFORE `.frame(height:)` for view to extend into safe area. `ProgressiveBlurEdge` applies `.frame` internally — for cases needing `.ignoresSafeArea`, inline `VariableBlurView` directly + respect order.
- **Separate overlays**: when blur + floating button have different safe area needs, use two distinct `.overlay()` — shared ZStack absorbs `.ignoresSafeArea` without extending children.
- `LinearGradient` still used for top onboarding where background quasi-monochrome at that level — no need real blur

---

## DR-011: iOS Swift 6 Migration & Build Optimization

**Date**: 2026-03-31

### Problem

iOS project used Swift 5.9 with `SWIFT_STRICT_CONCURRENCY: complete` (warnings). Clean build took ~52s with type-check hotspot of 5.2s on `RootView.body` (133 lines of chained modifiers). Several build settings not optimized.

### Decision Drivers

- Swift 6 turns concurrency violations into errors — project already ready (0 warning)
- `RootView.body` 133 lines caused type-checker bottleneck on critical build path
- XcodeGen default build settings no activate `EAGER_LINKING` nor `ONLY_ACTIVE_ARCH`
- `COMPILATION_CACHING` tested + evaluated twice (Swift 5.9 + Swift 6)

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Swift 6 + build optimization | Upgrade + refactor body + build settings | Chosen |
| B: Stay Swift 5.9 | No migration, wait Swift 6.x mature | Rejected — already ready, zero risk |
| C: `-default-isolation MainActor` (Swift 6.2) | Everything MainActor by default | Rejected — bad effort/benefit ratio, ~60+ types to opt-out |
| D: `COMPILATION_CACHING: YES` | Xcode compilation cache | Rejected — scan overhead +32% on cached clean builds, project too small (292 files) |

### Decision

1. **Swift 6**: `SWIFT_VERSION: "6"` — 0 app error, 10 test fixes (`nonisolated(unsafe)` for captured vars, `Task.init` instead of `TaskGroup.addTask` to bypass `sending` + `@MainActor` limitation)
2. **Refactor `RootView.body`**: extraction into 2 `ViewModifier` (`RootViewAlerts`, `RootViewSheets`) + `handleAppStart()` method — type-check 5254ms → 715ms
3. **Build settings**: `EAGER_LINKING: YES`, `ONLY_ACTIVE_ARCH: YES` in `project.yml` base settings
4. **`Task(name:)`** (Swift 6.2): 8 stored/cancellable tasks named for Instruments visibility
5. **`COMPILATION_CACHING`**: evaluated + **rejected** — `ScanDependencies` (23s vs 10s) + `SwiftDriver` (33s vs 20s) overhead exceeds gains for this code volume

### Rationale

- Swift 6 = 0 effort because `SWIFT_STRICT_CONCURRENCY: complete` already eliminated all violations
- ViewModifier refactor breaks type-checking chain into independent units — measurable gain on critical path
- `-default-isolation MainActor` rejected: removes ~44 `@MainActor` annotations (cosmetic) but forces adding `nonisolated` to ~60+ types/protocols (regression risk on actors conforming to `Sendable` protocols)
- `COMPILATION_CACHING` rejected after 2 benchmarks (Swift 5.9 + Swift 6): project at 292 Swift files no generates enough cache hits to offset verification cost. Re-evaluate at 500+ files.

### Consequences

- **Positive**: Clean build ~49s (vs 52s), `PulpeApp.body` type-check 86% faster, Swift 6 full strict
- **Trade-off**: `nonisolated(unsafe)` in 6 test files — acceptable because sequential closures on `@MainActor`
- **Trade-off**: `ONLY_ACTIVE_ARCH: YES` in base (all configs) — correct for iOS (arm64 only) but verify if macOS/Catalyst target added
- **Impact**: `project.yml`, `PulpeApp.swift`, 10 test files, 6 store files (Task naming), 5 rules/agent files

### Notes

- `ForEach(array.enumerated())` without `Array()`: not applicable, `EnumeratedSequence` `Collection` conformance gated iOS 26.0+ + deployment target is iOS 18.0
- Watch Swift 6.3+ for `COMPILATION_CACHING` improvement + `-default-isolation MainActor` stabilization

---

## DR-010: Greenlight Preflight & FormTextField `hint:` Rename

**Date**: 2026-03-16

### Problem

`greenlight preflight` tool (App Store pre-submission scanner) flagged two false positives on word "placeholder":
1. `placeholder:` parameter of `FormTextField` — detected as user-facing placeholder content
2. `placeholder(in:)` method of `TimelineProvider` protocol (WidgetKit) — Apple-mandatory method

### Decision Drivers

- Greenlight v0.1.0 (Homebrew) no ignore/suppress mechanism (no config, no inline comment)
- `placeholder(in:)` required by Apple on `TimelineProvider`, `IntentTimelineProvider` AND `AppIntentTimelineProvider` (iOS 17+) — no alternative
- Scan must return 0 findings for CI

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Rename `FormTextField.placeholder:` → `hint:` | Removes false positive #1 | Chosen |
| B: Move widget file outside `ios/` | Scanner no finds | Rejected — code smell |
| C: Wrapper script with `jq` filter | Filters known false positives | Rejected — hides real problems |
| D: Build greenlight from source (main) | `main` branch has `ignorePatterns` for WidgetKit | Chosen |

### Decision

1. **FormTextField**: rename `placeholder:` → `hint:` param in `FormTextField` + 7 call sites
2. **WidgetKit**: install greenlight from `main` (not Homebrew release 0.1.0) because source code already has `ignorePatterns` for `func placeholder(` but fix not yet in Homebrew release

### Rationale

- `hint:` semantically correct (it's the TextField hint text) + avoids dumb scanner grep
- WidgetKit fix exists in greenlight Go source (`internal/codescan/rules.go`) with explicit `ignorePatterns` for `func\s+placeholder\s*\(`, but tag v0.1.0 no includes it
- No clean solution Swift-side — `placeholder(in:)` method = unmodifiable Apple protocol requirement

### Consequences

- **Positive**: 0 greenlight findings with `dev` version built from `main`
- **Trade-off**: Dep on non-released greenlight version — monitor next Homebrew release to switch back to `brew install`
- **Impact**: `FormTextField.swift`, 7 renamed call sites, iOS `CLAUDE.md` updated

### Notes

- When greenlight publishes new Homebrew release with `ignorePatterns`, switch back to `brew install revylai/tap/greenlight` + remove custom binary from `/opt/homebrew/bin/`
- Current installed version: `greenlight dev` (build from `main` 2026-03-16)
- Install command: `git clone https://github.com/RevylAI/greenlight.git && go build -o greenlight ./cmd/greenlight`
---

## DR-009: Signal Store Pattern with SWR

**Date**: 2026-02-13

### Problem

Stores used RxJS `Subject` + `concatMap` for mutations + showed fullscreen spinner on each refetch, even for background refresh.

### Decision Drivers

- Angular 21+ signals-first: RxJS mutation queues add useless complexity
- UX: user prefers stale data over spinner each nav

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: RxJS mutation queue + systematic spinner | Keep `Subject` + `concatMap` + global `isLoading` | Rejected — over-engineered |
| B: async/await mutations + SWR pattern | Direct mutations, `isInitialLoading` for initial spinner only | Chosen |

### Decision

Standardize store pattern in 6 sections (Dependencies, State, Resource, Selectors, Mutations, Private utils) with:
- Mutations in direct async/await (no more Subject queue)
- `isInitialLoading = computed(() => resource.status() === 'loading')` for initial spinner only
- Stale data visible during reloading

### Consequences

- **Positive**: Simpler code, better UX (no spinner flash)
- **Trade-off**: No integrated queueing (not needed at current volume)
- **Impact**: `BudgetDetailsStore`, `CurrentMonthStore`, `BudgetTemplatesStore` refactored

---

## DR-008: Centralized ApiClient with Mandatory Zod Validation

**Date**: 2026-02-13

### Problem

API services injected `HttpClient` directly with inconsistent error handling + validation across features.

### Decision Drivers

- No runtime API response validation → silent bugs if backend contract changes
- Error handling duplicated each service
- No error normalization (different format per service)

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Direct HttpClient | Each service handles own errors + parsing | Rejected — inconsistent |
| B: Centralized ApiClient with Zod | Single service with mandatory validation | Chosen |

### Decision

All HTTP calls go through `ApiClient` (`core/api/api-client.ts`) with mandatory Zod schema. Feature APIs (`BudgetApi`, `TemplateApi`, etc.) return validated `Observable<T>`.

### Consequences

- **Positive**: Runtime validation, uniform error handling, better debugging
- **Trade-off**: Each endpoint needs Zod schema
- **Impact**: 10+ services migrated (BudgetApi, TransactionApi, TemplateApi, EncryptionApi, UserSettingsApi, BudgetLineApi, BudgetTemplatesApi, ProfileSetupService, DemoInitializerService)

### Notes

- `ApplicationConfiguration` = only exception: loads `config.json` (static asset) via direct `HttpClient` because `ApiClient` depends on it for `backendApiUrl` (circular dep).

---

## DR-007: Zoneless Testing — Child Input Signal Limitation

**Date**: 2026-02-13

### Problem

During `reset-password.spec.ts` test hardening (replacing private signal reads with DOM assertions), assertions targeting child components (`ErrorAlert`, `LoadingButton`) systematically fail. In zoneless mode (`provideZonelessChangeDetection()`), child component `input()` signals no update via `fixture.detectChanges()`, even after multiple cycles.

### Decision Drivers

- `ErrorAlert`: `message = input<string | null>(null)` — `@if (message())` stays false after `detectChanges()`
- `LoadingButton`: `disabled = input(false)` — internal `<button>` keeps `disabled` at initial value
- Behavior reproducible 100% on Vitest + Angular 21 + `provideZonelessChangeDetection()`

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: DOM assertions on child components | Read `getErrorAlertText()` / `button.disabled` | Rejected — 100% flake |
| B: Direct assertions on parent signals | Keep `component['errorMessage']()` / `component['canSubmit']()` | Chosen |
| C: Material Harnesses | Use Angular Material harnesses | Deferred — disproportionate overhead for this batch |

### Decision

Keep private signal reads (`component['...']()`) for assertions traversing child components with `input()` signal. Limit DOM assertions to elements rendered directly in parent component template (`@if`/`@else` blocks, `data-testid` on native elements).

### Rationale

- Parent DOM assertions work (`[data-testid="reset-password-form"]`, `mat-spinner` presence/absence) because test conditional visibility in parent template
- Child DOM assertions fail because `[message]="errorMessage()"` binding to child `input()` signal not propagated by `detectChanges()` in zoneless mode
- Private signal coupling acceptable in test: no leak into production code + stable while internal API no changes

### Consequences

- **Positive**: Stable tests (57/57, 10/10 runs), no flakiness
- **Trade-off**: ~13 remaining `component['...']` accesses in `reset-password.spec.ts` instead of ~8
- **Trade-off**: Test debt documented — revisitable if Angular fixes zoneless test behavior

### Notes

- Limitation confirmed on: `ErrorAlert` (`ui/error-alert`), `LoadingButton` (`ui/loading-button`)
- Valid pattern for parent DOM assertions: `@if`/`@else` conditionals, native element presence/absence
- Invalid pattern for child DOM assertions: `input()` signal bindings on OnPush components

## DR-005: Temp ID Replacement Before Toggle Cascade

**Date**: 2026-01-30

### Problem

Creating a transaction under a checked parent budget line triggered a 404 error. The store called `toggleCheck` on the parent **before** replacing the temp ID (`temp-xxx`) with the real server ID. The cascade (`calculateBudgetLineToggle`) then included temp IDs in `transactionsToToggle`, causing `POST /transactions/temp-xxx/check → 404`.

### Decision Drivers

- Optimistic updates generate temp IDs (`temp-${uuidv4()}`) for immediate UI feedback
- `calculateBudgetLineToggle` is a pure function that returns whatever IDs are in state
- API calls require real server-assigned UUIDs

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Reorder operations | Replace temp ID before triggering cascade | Chosen |
| B: Filter temp IDs in cascade | Skip `temp-*` IDs in `transactionsToToggle` | Rejected |

### Decision

In `createAllocatedTransaction()`, replace the temp ID with the server response **before** triggering the parent budget line's `toggleCheck` cascade.

### Rationale

- Option A fixes root cause (ordering) without coupling pure utility to ID format conventions
- Option B would leak impl details (`temp-` prefix) into `calculateBudgetLineToggle`
- Pure functions shouldn't know about temp ID conventions — store controls operation ordering

### Consequences

- **Positive**: No temp IDs reach API calls; pure functions remain agnostic
- **Trade-off**: Sequential await (replace → then toggle) instead of parallel
- **Impact**: `budget-details-store.ts:519-530` reordered

### Notes

Pattern applies to any optimistic update followed by cascade: always resolve temp IDs before triggering dependent operations.

---

## DR-001: Backend-First Demo Mode

**Date**: 2025-06-15

### Problem

Needed demo mode for product exploration without signup.

### Decision Drivers

- Must behave identically to production
- Cannot maintain parallel frontend-only simulation
- Must reuse existing RLS policies

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Real ephemeral users | Create Supabase users with `is_demo: true` | Chosen |
| B: Frontend localStorage mock | Simulate state in browser | Rejected |

### Decision

Create real ephemeral Supabase users with JWT tokens.

### Rationale

- Guarantees identical behavior to production (no simulation drift)
- Reuses existing RLS policies + business logic
- Simplifies frontend (same code paths demo/real users)

### Consequences

- **Positive**: No simulation drift, full backend validation
- **Trade-off**: Requires cleanup cron job (see DR-002)
- **Dependencies**: Supabase Auth, RLS policies

### Notes

Stack-specific: Supabase cascade delete handles cleanup of related tables auto.

---

## DR-002: Automated Demo Cleanup Strategy

**Date**: 2025-06-15

### Problem

Prevent database bloat from abandoned demo users.

### Decision Drivers

- Must run auto no manual intervention
- Balance cleanup frequency vs DB load
- Must not affect active demo sessions

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Automated cron job | Every 6h, 24h retention | Chosen |
| B: Manual cleanup only | Admin triggers manually | Rejected |

### Decision

Automated cron job cleanup with:
- Schedule: Every 6 hours (00:00, 06:00, 12:00, 18:00 UTC)
- Retention: 24 hours from user creation
- Manual endpoint: Dev-only for testing/emergency cleanup

### Rationale

- 24h retention: sufficient exploration time, no excessive DB usage
- 6h interval: balances cleanup frequency vs DB load
- Supabase cascade delete: auto cleanup of budgets/transactions/templates

### Consequences

- **Positive**: Zero maintenance overhead
- **Trade-off**: Users lose demo data after 24h (acceptable for demo)
- **Dependencies**: Supabase scheduled functions, cascade delete

### Notes

Consider adding warning toast at 23h mark if user session still active.

---

## DR-003: Remove Variable Transaction Recurrence

**Date**: 2025-07-20

### Problem

Initial design included `monthly`/`one_off` recurrence for transactions, adding unnecessary complexity.

### Decision Drivers

- Aligns with "Planning > Tracking" philosophy
- Reduces frontend/backend complexity
- YAGNI principle

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Remove recurrence | Transactions always one-off | Chosen |
| B: Keep recurrence | Support recurring transactions | Rejected |

### Decision

Remove recurrence entirely from transactions:
- Budget lines: Keep frequency (`fixed`/`one_off`) for planning
- Transactions: Always one-off manual entries

### Rationale

- Budget lines = plan, transactions = reality
- Recurring patterns belong in templates/budget lines, not transactions
- Simplifies transaction model significantly

### Consequences

- **Positive**: Cleaner planning/tracking separation
- **Trade-off**: No auto recurring transaction support
- **Impact**: Removed `recurrence` column from transaction table

### Notes

If users request recurring transactions future, implement as "auto-generated budget lines" rather than transaction recurrence.

---

## DR-004: Typed & Versioned Storage Service

**Date**: 2025-11-10

### Problem

Data leak bug between users (persistent localStorage data after logout). Initial fix by `pulpe-*` key cleanup but fragile approach.

### Decision Drivers

- Type-safety required for compile-time errors
- Need automatic migrations when schema changes
- Must distinguish user-scoped vs app-scoped data

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Typed storage service | Centralized registry with versioning | Chosen |
| B: Prefix convention | Clean `pulpe-*` keys on logout | Rejected |

### Decision

Implement typed storage service with:
- Centralized registry with strong typing
- Zod validation on read
- Per-key versioning: `{ version, data, updatedAt }`
- Automatic migrations at startup
- `user-scoped` vs `app-scoped` distinction

### Rationale

- Type-safety: compile-time errors for wrong key/value
- Evolvability: auto migrations on schema changes
- Maintainability: single source of truth for all keys
- Debugging: versioning enables state tracing

### Consequences

- **Positive**: Eliminates class of storage bugs
- **Trade-off**: Initial implementation overhead
- **Dependencies**: Zod schemas

### Notes

Implemented. Service in `core/storage/`.

---

## DR-006: Split-Key Encryption for Financial Amounts

**Date**: 2026-01-29

### Problem

Supabase admin can read all financial amounts cleartext (`NUMERIC(12,2)`) via Dashboard or SQL client. Pulpe claims financial data confidentiality — promise must be technically real before any public launch.

### Decision Drivers

- Admin (project owner) must not be able to decrypt user data
- Backend must perform calculations (rollover, sums, balances)
- Client-side crypto code must stay minimal (3 platforms: Angular, SwiftUI, Android)
- 3 existing production users must lose no data

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: Server-side only (master key) | Backend encrypts with env var key | Rejected — admin can decrypt |
| B: Client-side E2E | All crypto in browser/app | Rejected — backend no can calculate |
| C: Split-key (client PBKDF2 + backend HKDF) | DEK derived from two parts: clientKey (password) + masterKey (env var) | Chosen |

### Decision

Split-key architecture:
- **Client**: derives `clientKey` from PIN code via PBKDF2 (600k iterations, SHA-256)
- **Backend**: combines `clientKey` + `masterKey` via HKDF → DEK used for AES-256-GCM
- **DEK never stored**: derived each request, discarded after processing (5 min memory cache)
- **Table `user_encryption_key`**: stores `salt`, `kdf_iterations`, `key_check` (canary), `wrapped_dek` (recovery)
- **Recovery key**: DEK wrapped with user recovery key (AES-256-GCM)
- **Encrypted columns**: `amount`, `original_amount`, `target_amount`, `original_target_amount`, `ending_balance` = `text` columns containing base64 ciphertexts

### Rationale

- masterKey alone insufficient to decrypt → admin no can read data at rest
- Backend sees cleartext data in memory during requests → enables server calculations
- Client-side PBKDF2 = few native lines (Web Crypto API, CryptoKit, JCA) → no third-party lib

### Consequences

- **Positive**: Marketing claim "even admin no can decrypt without your PIN code" technically true
- **Trade-off**: PIN code loss without recovery key = data access loss
- **Trade-off**: Password change re-encrypts all data (negligible at current volume)
- **Trade-off**: ~300-500ms of PBKDF2 on client-side login (once only)
- **Dependencies**: Web Crypto API (Angular), CryptoKit (SwiftUI), JCA (Android)

### Notes

- GitHub issue: [#274](https://github.com/neogenz/pulpe/issues/274)
- Impacted tables: `budget_line`, `transaction`, `template_line`, `savings_goal`, `monthly_budget`
- Row-by-row re-encryption acceptable current volume; batch if >1000 users

---

## DR-014: Multi-Currency with Conversion Metadata

**Date**: 2026-03-06

### Problem

Pulpe locked on CHF only. Swiss users near border (Geneva, Basel) regularly make EUR expenses.

### Decision Drivers

- Real need of border users (CHF ↔ EUR)
- Converted amounts must stay traceable (which original amount, which rate)
- Existing encryption (DR-006) must cover new amounts

### Options Considered

| Option | Description | Verdict |
|--------|-------------|---------|
| A: On-the-fly conversion (no storage) | Convert at day rate each display | Rejected — traceability loss |
| B: Persisted conversion metadata | Store original amount, currency, rate at entry time | Chosen |

### Decision

Each financial entity (transaction, budget_line, template_line, savings_goal) stores 4 optional conversion metadata columns:
- `original_amount` / `original_target_amount` — amount entered in origin currency (AES-256-GCM encrypted)
- `original_currency` — origin currency (ex: EUR)
- `target_currency` — target currency (ex: CHF)
- `exchange_rate` — rate frozen at entry time

Backend exposes `CurrencyModule` with:
- `CurrencyService` — rate fetch via Frankfurter API (`frankfurter.dev`), 24h cache, rate auto-fill if absent
- `CurrencyController` — `GET /currency/rate?base=CHF&target=EUR`

Supported currencies: CHF, EUR (validated by `supportedCurrencySchema` Zod).

Extended user settings: `currency` (preferred currency, default CHF) + `showCurrencySelector` (toggle) in Supabase `user_metadata`.

### Rationale

- Metadata historical, not live — rate frozen definitively at entry
- All columns nullable for backward compatibility (existing data = no conversion)
- `rekey_user_encrypted_data` RPC also re-encrypts `original_amount` / `original_target_amount` on PIN change

### Consequences

- **Positive**: Full conversion traceability, extensible to other currencies
- **Trade-off**: Frankfurter API dependency (503 fallback if unavailable)
- **Impact**: 4 DB migrations, new backend module, frontend + iOS services, extended user settings

### Notes

- GitHub issue: [#248](https://github.com/neogenz/pulpe/issues/248)
- Frontend: `CurrencyConverterService` (5 min cache), `CurrencyConversionBadge` (badge with tooltip)
- iOS: `CurrencyConversionService`, `CurrencySettingView`

---

*See `systemPatterns.md` for architecture patterns.*
*See `INFRASTRUCTURE.md` for deployment and CI/CD.*