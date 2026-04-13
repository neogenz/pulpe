---
description: PostHog event naming convention
paths: "**/analytics/**"
---

# PostHog Events

## Naming Convention

**Pattern:** `object_action` in `snake_case`

```typescript
// Good
captureEvent('signup_started');
captureEvent('budget_created');
captureEvent('tutorial_completed');

// Bad
captureEvent('SignupStarted');      // PascalCase
captureEvent('user-signed-up');     // kebab-case
captureEvent('click');              // Too vague
```

## Conversion Funnel

**Web:**
```
$pageview (landing) → cta_clicked → welcome_page_viewed → signup_started
→ signup_completed → vault_code_setup_completed → onboarding_started
→ profile_step1_completed → profile_step2_completed → first_budget_created
```

**Web (with demo):**
```
welcome_page_viewed → demo_started → signup_started → signup_completed → ...
```

**iOS:**
```
app_opened → welcome_screen_viewed → onboarding_started
→ onboarding_step_completed (first_name) → signup_started → signup_completed
→ onboarding_step_completed (income, charges, savings, budget_preview)
→ pin_setup_completed → first_budget_created
```

`onboarding_started` fires once per session on the first transition out of
welcome (email tap) or on fresh social OAuth entry into the flow.
`signup_started` fires when the user reaches the registration form (post
reorder — it's step 3, not step 1).

**Tracking approach:**
- Pre-auth events (`signup_started`) are captured as anonymous events (`person_profiles: 'identified_only'`)
- Full auto-capture (pageviews, autocapture) enabled after authentication
- Google OAuth uses `PostHogService.setPendingSignupMethod()` to store the method via `StorageService`, then `capturePendingSignupCompleted()` fires `signup_completed` after redirect
- **iOS:** Uses `AnalyticsService.shared` actor (not PostHogSDK directly)
- **iOS:** Manual screen tracking via `.trackScreen()` view modifier
- **iOS:** PostHog disabled in local environment (`POSTHOG_ENABLED = false` in xcconfig)
- **iOS:** Financial data sanitized — amounts and balances are never included in event properties

## Events Catalog

### Landing Page Events

| Event | When | Properties |
|-------|------|------------|
| `$pageview` | Auto-captured on page load | `$current_url` |
| `cta_clicked` | User clicks CTA button | `cta_name`, `cta_location`, `destination` |

### Welcome & Auth Flow Events

| Event | When | Properties |
|-------|------|------------|
| `welcome_page_viewed` | User lands on /welcome | `$referrer`, `$utm_source` (auto) |
| `signup_started` | User clicks signup button | `method` (`email` \| `google`) |
| `signup_completed` | Signup succeeds (email direct, Google via pending method) | `method` (`email` \| `google`) |
| `vault_code_setup_completed` | New user creates vault code | — |
| `vault_code_entered` | Returning user enters vault code | — |
| `demo_started` | Demo session created | — |

### Onboarding Events

| Event | When | Properties |
|-------|------|------------|
| `onboarding_started` | User lands on complete-profile | — |
| `profile_step1_completed` | First profile step done | — |
| `profile_step2_completed` | Second profile step done | — |
| `profile_step2_skipped` | Second profile step skipped | — |
| `first_budget_created` | User creates initial budget | `signup_method`, `has_pay_day`, `charges_count`, `custom_transactions_count` |
| `onboarding_suggestion_toggled` | User taps a suggestion chip (charges or savings step) | `step` (`charges` \| `savings` \| `income`), `suggestion_name`, `selected` (bool) |
| `custom_transaction_added` | User adds a custom row via dialog or suggestion chip | `step`, `kind` (`expense` \| `saving` \| `income`), `source` (`manual` \| `suggestion`) |
| `custom_transaction_removed` | User removes a custom row | `step`, `kind`, `source` |

### Tutorial Events

| Event | When | Properties |
|-------|------|------------|
| `tutorial_started` | Tutorial begins | — |
| `tutorial_completed` | Tutorial finished | — |
| `tutorial_cancelled` | User skips tutorial | — |

### iOS App Events

| Event | When | Properties |
|-------|------|------------|
| `app_opened` | App enters foreground | — |
| `welcome_screen_viewed` | Welcome screen appears (new user), idempotent per view instance | — |
| `onboarding_started` | First exit from welcome (email tap) or fresh social OAuth entry | `method` (`email` \| `apple` \| `google`) |
| `onboarding_step_completed` | User completes an onboarding step | `step` (`first_name` \| `registration` \| `income` \| `charges` \| `savings` \| `budget_preview`), `step_index`, `step_total`, `auth_method` (`email` \| `apple` \| `google`) |
| `onboarding_abandoned` | User exits onboarding before completing | `last_step`, `exit_method` (`background` \| `quit_button` \| `restart_button`), `was_authenticated`, `auth_method` |
| `onboarding_resumed` | Email user cold-starts an in-progress signup | `method` (`email`), `source` (`pending_user` \| `session_fallback`), `resumed_at_step` |
| `signup_started` | User reaches the registration form (step 3) | `method` (`email` \| `apple` \| `google`) |
| `signup_completed` | Signup succeeds | `method` (`email` \| `apple` \| `google`) |
| `login_completed` | Login succeeds | `method` (`email` \| `biometric` \| `google` \| `apple`) |
| `login_failed` | Login fails (any method) | `method`, `error_kind`, `error_message` |
| `signup_failed` | Signup fails | `method`, `error_kind`, `error_message` |
| `session_restore_failed` | Session restore at startup fails | `method`, `error_kind`, `error_message` |
| `pin_setup_completed` | PIN created successfully | — |
| `pin_entered` | PIN entered on return visit | — |
| `first_budget_created` | Initial budget created at the end of onboarding | `signup_method` (`email` \| `apple` \| `google`), `has_pay_day`, `charges_count`, `custom_transactions_count` |
| `onboarding_suggestion_toggled` | User taps a suggestion chip (charges or savings step) | `step` (`charges` \| `savings` \| `income`), `suggestion_name`, `selected` (bool) |
| `custom_transaction_added` | User adds a custom row via the "+ Ajouter" sheet or a suggestion chip | `step`, `kind` (`expense` \| `saving` \| `income`), `source` (`manual` \| `suggestion`) |
| `custom_transaction_removed` | User removes a custom row via swipe, trash, or by toggling a suggestion off | `step`, `kind`, `source` |
| `budget_created` | Budget created outside the onboarding flow | — |
| `transaction_created` | Transaction added | `type` (`expense` \| `income` \| `saving`) |
| `tab_switched` | User switches tab | `tab` (`currentMonth` \| `budgets` \| `templates`) |
| `logout_completed` | User logs out | — |

**iOS funnel idempotency guarantees:**
- `onboarding_started` fires once per `OnboardingFlow` instance (@State guard). Resets on view re-instantiation via `.id(appState.onboardingSessionID)` after abandon.
- `onboarding_abandoned` fires at most once per `OnboardingState` (state.hasAbandoned flag).
- `onboarding_resumed` fires once per instance and is mutually exclusive with `onboarding_started` for the same session.
- `welcome_screen_viewed` fires once per **session** via `state.hasEmittedWelcomeViewed` on `OnboardingState`. Critical: the guard lives on the state (not on the `WelcomeStep` view) because `OnboardingFlow` tears down and re-creates step views on every step change via `.id(state.currentStep)` — a local `@State` guard would double-fire on back-nav.
- `signup_started` fires once per **session** via `state.hasEmittedSignupStarted` on `OnboardingState`. Same re-instantiation trap as `welcome_screen_viewed`.
- `onboarding_step_completed` for `budget_preview` fires once per session via `state.hasEmittedBudgetPreviewCompleted`. Prevents rapid-double-tap and retry-after-error from double-firing the funnel event; the CTA also disables once `state.readyToComplete` or `state.isSubmitting` is true.

## Properties

**Global properties** (sent with every event):
```
platform: 'web' | 'landing' | 'ios'
```

```typescript
// Use snake_case, be specific
captureEvent('budget_created', {
  has_pay_day: true,
  charges_count: 5,
  signup_method: 'google'
});
```

## Rules

1. Always `snake_case`
2. Format: `object_action` in past tense (`signup_completed`, `budget_created`, `welcome_screen_viewed`). This follows the [Segment Tracking Plan spec](https://segment.com/docs/connections/spec/semantic/) used by Mixpanel, Amplitude, and PostHog's own SDK examples (`user_signed_up`). Events represent things that *already happened*, so past tense reads naturally. PostHog's best-practices page contradicts itself on tense — ignore it, trust the examples.
3. Be specific: `budget_created` not `created`
4. Flow markers: `_started`, `_completed`, `_cancelled`, `_abandoned`, `_resumed`, `_failed`
5. Event names are static strings — never interpolated (`page_viewed_${name}` is forbidden; use a fixed name + a property)
6. Keep the iOS and web funnels in sync whenever possible so cross-platform insights stay comparable
7. Properties also use `snake_case`. Value spaces are documented in the catalog above (e.g. `method` is always `email | apple | google | biometric`)
