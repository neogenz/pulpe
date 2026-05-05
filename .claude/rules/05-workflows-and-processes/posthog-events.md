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

`onboarding_started` fires once per session on first transition out of welcome (email tap) or on fresh social OAuth entry into flow. `signup_started` fires when user reach registration form (post reorder — step 3, not step 1).

**Tracking approach:**
- Pre-auth events (`signup_started`) captured as anonymous (`person_profiles: 'identified_only'`)
- Full auto-capture (pageviews, autocapture) enabled after auth
- Google OAuth use `PostHogService.setPendingSignupMethod()` to store method via `StorageService`, then `capturePendingSignupCompleted()` fire `signup_completed` after redirect
- **iOS:** Use `AnalyticsService.shared` actor (not PostHogSDK directly)
- **iOS:** Manual screen tracking via `.trackScreen()` view modifier
- **iOS:** PostHog disabled in local env (`POSTHOG_ENABLED = false` in xcconfig)
- **iOS:** Financial data sanitized — amounts and balances never in event properties

## Events Catalog

### Landing Page Events

| Event | When | Properties |
|-------|------|------------|
| `$pageview` | Auto-captured on page load | `$current_url` |
| `cta_clicked` | User click CTA button | `cta_name`, `cta_location`, `destination` |

### Welcome & Auth Flow Events

| Event | When | Properties |
|-------|------|------------|
| `welcome_page_viewed` | User land on /welcome | `$referrer`, `$utm_source` (auto) |
| `signup_started` | User click signup button | `method` (`email` \| `google`) |
| `signup_completed` | Signup succeed (email direct, Google via pending method) | `method` (`email` \| `google`) |
| `vault_code_setup_completed` | New user create vault code | — |
| `vault_code_entered` | Returning user enter vault code | — |
| `demo_started` | Demo session created | — |

### Onboarding Events

| Event | When | Properties |
|-------|------|------------|
| `onboarding_started` | User land on complete-profile | — |
| `profile_step1_completed` | First profile step done | — |
| `profile_step2_completed` | Second profile step done | — |
| `profile_step2_skipped` | Second profile step skipped | — |
| `first_budget_created` | User create initial budget | `signup_method`, `has_pay_day`, `charges_count`, `custom_transactions_count` |
| `onboarding_suggestion_toggled` | User tap suggestion chip (charges or savings step) | `step` (`charges` \| `savings` \| `income`), `suggestion_name`, `selected` (bool) |
| `custom_transaction_added` | User add custom row via dialog or suggestion chip | `step`, `kind` (`expense` \| `saving` \| `income`), `source` (`manual` \| `suggestion`) |
| `custom_transaction_removed` | User remove custom row | `step`, `kind`, `source` |

### Tutorial Events

| Event | When | Properties |
|-------|------|------------|
| `tutorial_started` | Tutorial begin | — |
| `tutorial_completed` | Tutorial finish | — |
| `tutorial_cancelled` | User skip tutorial | — |

### Settings / Account Events

| Event | When | Properties | Web | iOS |
|-------|------|------------|-----|-----|
| `currency_changed` | User select different currency in settings + save (web) or pick (iOS) succeeds | `from` (`CHF` \| `EUR`), `to` (`CHF` \| `EUR`) | ✅ | ✅ |
| `currency_selector_toggled` | User toggle "Saisir dans une autre devise" + save succeeds | `enabled` (bool) | ✅ | ✅ |

Both events naturally gate on the `multi-currency-enabled` flag because the corresponding UI is only rendered when it's enabled. Event names + property keys are sourced from `pulpe-shared` (`ANALYTICS_EVENTS`) — never hardcode.

### iOS App Events

| Event | When | Properties |
|-------|------|------------|
| `app_opened` | App enter foreground | — |
| `welcome_screen_viewed` | Welcome screen appear (new user), idempotent per view instance | — |
| `onboarding_started` | First exit from welcome (email tap) or fresh social OAuth entry | `method` (`email` \| `apple` \| `google`) |
| `onboarding_step_completed` | User complete onboarding step | `step` (`first_name` \| `registration` \| `income` \| `charges` \| `savings` \| `budget_preview`), `step_index`, `step_total`, `auth_method` (`email` \| `apple` \| `google`) |
| `onboarding_abandoned` | User exit onboarding before complete | `last_step`, `exit_method` (`background` \| `quit_button` \| `restart_button`), `was_authenticated`, `auth_method` |
| `onboarding_resumed` | Email user cold-start in-progress signup | `method` (`email`), `source` (`pending_user` \| `session_fallback`), `resumed_at_step` |
| `signup_started` | User reach registration form (step 3) | `method` (`email` \| `apple` \| `google`) |
| `signup_completed` | Signup succeed | `method` (`email` \| `apple` \| `google`) |
| `login_completed` | Login succeed | `method` (`email` \| `biometric` \| `google` \| `apple`) |
| `login_failed` | Login fail (any method) | `method`, `error_kind`, `error_message` |
| `signup_failed` | Signup fail | `method`, `error_kind`, `error_message` |
| `session_restore_failed` | Session restore at startup fail | `method`, `error_kind`, `error_message` |
| `pin_setup_completed` | PIN created | — |
| `pin_entered` | PIN entered on return visit | — |
| `first_budget_created` | Initial budget created at end of onboarding | `signup_method` (`email` \| `apple` \| `google`), `has_pay_day`, `charges_count`, `custom_transactions_count` |
| `onboarding_suggestion_toggled` | User tap suggestion chip (charges or savings step) | `step` (`charges` \| `savings` \| `income`), `suggestion_name`, `selected` (bool) |
| `custom_transaction_added` | User add custom row via "+ Ajouter" sheet or suggestion chip | `step`, `kind` (`expense` \| `saving` \| `income`), `source` (`manual` \| `suggestion`) |
| `custom_transaction_removed` | User remove custom row via swipe, trash, or toggling suggestion off | `step`, `kind`, `source` |
| `budget_created` | Budget created outside onboarding flow | — |
| `transaction_created` | Transaction added | `type` (`expense` \| `income` \| `saving`) |
| `tab_switched` | User switch tab | `tab` (`currentMonth` \| `budgets` \| `templates`) |
| `logout_completed` | User log out | — |

**iOS funnel idempotency guarantees:**
- `onboarding_started` fire once per `OnboardingFlow` instance (@State guard). Reset on view re-instantiation via `.id(appState.onboardingSessionID)` after abandon.
- `onboarding_abandoned` fire at most once per `OnboardingState` (state.hasAbandoned flag).
- `onboarding_resumed` fire once per instance, mutually exclusive with `onboarding_started` for same session.
- `welcome_screen_viewed` fire once per **session** via `state.hasEmittedWelcomeViewed` on `OnboardingState`. Critical: guard live on state (not on `WelcomeStep` view) because `OnboardingFlow` tear down and re-create step views on every step change via `.id(state.currentStep)` — local `@State` guard would double-fire on back-nav.
- `signup_started` fire once per **session** via `state.hasEmittedSignupStarted` on `OnboardingState`. Same re-instantiation trap as `welcome_screen_viewed`.
- `onboarding_step_completed` for `budget_preview` fire once per session via `state.hasEmittedBudgetPreviewCompleted`. Prevent rapid-double-tap and retry-after-error from double-firing funnel event; CTA also disable once `state.readyToComplete` or `state.isSubmitting` true.

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
2. Format: `object_action` in past tense (`signup_completed`, `budget_created`, `welcome_screen_viewed`). Follow [Segment Tracking Plan spec](https://segment.com/docs/connections/spec/semantic/) used by Mixpanel, Amplitude, and PostHog's own SDK examples (`user_signed_up`). Events represent things that *already happened*, so past tense read naturally. PostHog's best-practices page contradict itself on tense — ignore it, trust examples.
3. Be specific: `budget_created` not `created`
4. Flow markers: `_started`, `_completed`, `_cancelled`, `_abandoned`, `_resumed`, `_failed`
5. Event names static strings — never interpolated (`page_viewed_${name}` forbidden; use fixed name + property)
6. Keep iOS and web funnels in sync when possible so cross-platform insights stay comparable
7. Properties also use `snake_case`. Value spaces documented in catalog above (e.g. `method` always `email | apple | google | biometric`)