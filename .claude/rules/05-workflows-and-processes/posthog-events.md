---
description: PostHog event naming convention
paths: "**/analytics/**"
---

# PostHog Events

## Naming Convention

**Pattern:** `object_action` in `snake_case`

```typescript
// Good
captureEvent("signup_started");
captureEvent("budget_created");
captureEvent("transaction_created");

// Bad
captureEvent("SignupStarted"); // PascalCase
captureEvent("user-signed-up"); // kebab-case
captureEvent("click"); // Too vague
```

## Conversion Funnel

**Web:**

```
$pageview (landing) → cta_clicked → welcome_viewed → signup_started
→ signup_completed → pin_setup_completed → onboarding_started
→ onboarding_step_completed (profile) → onboarding_step_completed (charges)
→ first_budget_created
```

**Web (with demo):**

```
welcome_viewed → demo_started → signup_started → signup_completed → ...
```

**iOS (email):**

```
app_opened → welcome_viewed → onboarding_started
→ onboarding_step_completed (first_name) → signup_started → signup_completed
→ onboarding_step_completed (registration → income → charges → savings)
→ pin_setup_completed → onboarding_step_completed (budget_preview)
→ first_budget_created
```

**iOS (social):**

```
app_opened → welcome_viewed → signup_started → signup_completed
→ onboarding_started → onboarding_step_completed (first_name, if missing)
→ onboarding_step_completed (income → charges → savings)
→ pin_setup_completed → onboarding_step_completed (budget_preview)
→ first_budget_created
```

`onboarding_started` fires once per session on first transition out of welcome (email tap) or on fresh social OAuth entry into flow. `signup_started` fires on email registration form entry or on a social provider signup attempt from welcome.

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

| Event         | When                       | Properties                                |
| ------------- | -------------------------- | ----------------------------------------- |
| `$pageview`   | Auto-captured on page load | `$current_url`                            |
| `cta_clicked` | User click CTA button      | `cta_name`, `cta_location`, `destination` |

### Welcome & Auth Flow Events

| Event                 | When                                     | Properties                                                                                                                        |
| --------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `welcome_viewed`      | User lands on /welcome                   | —                                                                                                                                 |
| `signup_started`      | User click signup button                 | `method` (`email` \| `google`)                                                                                                    |
| `signup_completed`    | Signup succeed                           | `method` (`email` \| `google`)                                                                                                    |
| `pin_setup_completed` | New user creates a PIN                   | —                                                                                                                                 |
| `pin_entered`         | Returning user enters their PIN          | —                                                                                                                                 |
| `demo_started`        | Demo session created                     | —                                                                                                                                 |
| `logout_completed`    | Web session ends after local sign-out    | `source` (`user_initiated` \| `vault_code` \| `demo_exit` \| `scheduled_deletion` \| `account_blocked`)                          |

### Onboarding Events

| Event                           | When                                               | Properties                                                                              |
| ------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `onboarding_started`            | User land on complete-profile                      | —                                                                                       |
| `onboarding_step_completed`     | User completes profile or charges step             | `step` (`profile` \| `charges`), `skipped` (charges only)                               |
| `first_budget_created`          | User create initial budget                         | `signup_method`, `has_pay_day`, `charges_count`, `custom_transactions_count`            |
| `onboarding_suggestion_toggled` | User tap suggestion chip (charges or savings step) | `step` (`charges` \| `savings` \| `income`), `suggestion_name`, `selected` (bool)       |
| `custom_transaction_added`      | User add custom row via dialog or suggestion chip  | `step`, `kind` (`expense` \| `saving` \| `income`), `source` (`manual` \| `suggestion`) |
| `custom_transaction_removed`    | User remove custom row                             | `step`, `kind`, `source`                                                                |

### Settings / Account Events

| Event                       | When                                                                           | Properties                                     | Web | iOS |
| --------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------- | --- | --- |
| `currency_changed`          | User select different currency in settings + save (web) or pick (iOS) succeeds | `from` (`CHF` \| `EUR`), `to` (`CHF` \| `EUR`) | ✅  | ✅  |
| `currency_selector_toggled` | User toggle "Saisir dans une autre devise" + save succeeds                     | `enabled` (bool)                               | ✅  | ✅  |
| `currency_persist_failed`   | iOS exhausts onboarding currency persistence retries                           | `currency`, `attempts`                         | —   | ✅  |

The settings events are available to every authenticated user. The selector itself follows the `showCurrencySelector` user preference; none is feature-gated. Event names + property keys are sourced from `pulpe-shared` (`ANALYTICS_EVENTS`) — never hardcode.

### iOS App Events

| Event                             | When                                                                | Properties                                                                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_opened`                      | App enter foreground                                                | —                                                                                                                                                                             |
| `welcome_viewed`                  | Welcome screen appears for a new user, once per session             | —                                                                                                                                                                             |
| `onboarding_started`              | First exit from welcome (email tap) or fresh social OAuth entry     | `method` (`email` \| `apple` \| `google`)                                                                                                                                     |
| `onboarding_step_completed`       | User complete onboarding step                                       | `step` (`first_name` \| `registration` \| `income` \| `charges` \| `savings` \| `budget_preview`), `step_index`, `step_total`, `auth_method` (`email` \| `apple` \| `google`) |
| `onboarding_abandoned`            | User exit onboarding before complete                                | `last_step`, `exit_method` (`background` \| `quit_button` \| `restart_button`), `was_authenticated`, `auth_method`                                                            |
| `onboarding_resumed`              | Email user cold-start in-progress signup                            | `method` (`email`), `source` (`pending_user` \| `session_fallback`), `resumed_at_step`                                                                                        |
| `signup_started`                  | User reach registration form (step 3)                               | `method` (`email` \| `apple` \| `google`)                                                                                                                                     |
| `signup_completed`                | Signup succeed                                                      | `method` (`email` \| `apple` \| `google`)                                                                                                                                     |
| `login_completed`                 | Login succeed                                                       | `method` (`email` \| `biometric` \| `google` \| `apple`)                                                                                                                      |
| `login_failed`                    | Login fail (any method)                                             | `method`, `error_kind`, `error_message`                                                                                                                                       |
| `signup_failed`                   | Signup fail                                                         | `method`, `error_kind`, `error_message`                                                                                                                                       |
| `session_restore_failed`          | Session restore at startup fail                                     | `method`, `error_kind`, `error_message`                                                                                                                                       |
| `auth_session_observed`           | Supabase session lifecycle or storage signal                        | `source`, `outcome`, optional `status`, `request_id`, `endpoint`, `is_retry`, `storage_state`, `access_token_expires_in_seconds`, `is_expected_user_action`                   |
| `pin_setup_completed`             | PIN created                                                         | —                                                                                                                                                                             |
| `pin_entered`                     | PIN entered on return visit                                         | —                                                                                                                                                                             |
| `pin_changed`                     | Existing PIN changed                                                | —                                                                                                                                                                             |
| `first_budget_created`            | Initial budget created at end of onboarding                         | `signup_method` (`email` \| `apple` \| `google`), `has_pay_day`, `charges_count`, `custom_transactions_count`                                                                 |
| `onboarding_suggestion_toggled`   | User tap suggestion chip (charges or savings step)                  | `step` (`charges` \| `savings` \| `income`), `suggestion_name`, `selected` (bool)                                                                                             |
| `custom_transaction_added`        | User add custom row via "+ Ajouter" sheet or suggestion chip        | `step`, `kind` (`expense` \| `saving` \| `income`), `source` (`manual` \| `suggestion`)                                                                                       |
| `custom_transaction_removed`      | User remove custom row via swipe, trash, or toggling suggestion off | `step`, `kind`, `source`                                                                                                                                                      |
| `budget_created`                  | Budget created outside onboarding flow                              | —                                                                                                                                                                             |
| `transaction_created`             | Transaction added                                                   | `type` (`expense` \| `income` \| `saving`)                                                                                                                                    |
| `tab_switched`                    | User switch tab                                                     | `tab` (`currentMonth` \| `budgets` \| `templates`)                                                                                                                            |
| `logout_completed`                | User log out                                                        | `source` (`user_initiated` \| `system`)                                                                                                                                       |
| `notification_prime_shown`        | Notification pre-permission sheet shown                             | —                                                                                                                                                                             |
| `notification_permission_granted` | Notification permission granted                                     | —                                                                                                                                                                             |
| `notification_permission_denied`  | Notification permission denied                                      | —                                                                                                                                                                             |
| `reminder_toggled`                | Reminder preference changed                                         | `enabled` (bool)                                                                                                                                                              |
| `ios_whats_new_shown`             | Dialog shown after app update with new release notes                | `version`                                                                                                                                                                     |
| `currency_changed`                | Display currency changed                                            | `from`, `to`                                                                                                                                                                  |
| `currency_selector_toggled`       | Per-amount currency selector preference changed                     | `enabled` (bool)                                                                                                                                                              |
| `currency_persist_failed`         | Onboarding currency persistence retries exhausted                   | `currency`, `attempts`                                                                                                                                                        |
| `savings_goals_intro_viewed`      | Savings-goals intro opened                                          | —                                                                                                                                                                             |
| `savings_goals_intro_completed`   | First savings goal created from the intro                           | —                                                                                                                                                                             |
| `savings_goals_intro_skipped`     | Savings-goals intro skipped                                         | —                                                                                                                                                                             |

### Legacy event names

These definitions remain queryable for historical data but must not be emitted.

| Legacy event                 | Canonical replacement                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `welcome_page_viewed`        | `welcome_viewed`                                                   |
| `welcome_screen_viewed`      | `welcome_viewed`                                                   |
| `vault_code_entered`         | `pin_entered`                                                      |
| `vault_code_setup_completed` | `pin_setup_completed`                                              |
| `profile_step1_completed`    | `onboarding_step_completed` with `step: profile`                   |
| `profile_step2_completed`    | `onboarding_step_completed` with `step: charges`, `skipped: false` |
| `profile_step2_skipped`      | `onboarding_step_completed` with `step: charges`, `skipped: true`  |

`auth_session_observed` value spaces:

- `source`: `sdk_event` | `session_validation` | `forced_refresh` | `api_401` |
  `vault_status_401` | `biometric_resync` | `supabase_auth_response` | `backend_api` |
  `keychain_write` | `keychain_read` | `keychain_remove` | `startup_result` |
  `post_auth_destination` | `deep_link` | `session_reset`
- session outcomes: `initial_session` | `token_refreshed` | `signed_out` | `started` |
  `succeeded` | `failed_retryable` | `storage_unreadable` | `missing_blob` |
  `undecodable_blob` | `valid_blob` | `session_not_found` | `session_expired` |
  `refresh_token_not_found` | `refresh_token_already_used` | `unauthorized`
- keychain outcomes: `update_failed` | `fallback_delete_failed` | `add_failed` | `failed`
- startup outcomes: `unauthenticated` | `network_error` | `biometric_session_expired` | `timeout`
- post-auth outcomes: `needs_pin_setup` | `needs_pin_entry` | `authenticated` |
  `unauthenticated_session_expired` | `vault_check_failed`
- deep-link outcomes: `widget_add_expense_received` | `widget_budget_received`
- terminal reset outcomes: `user_logout` | `account_deleted` | `signup_abandoned` |
  `startup_retry_abandoned` | `password_reset` | `api_session_expired` |
  `recovery_session_expired` | `background_session_missing` | `session_refresh_failed` |
  `system_unspecified`
- `storage_state`: `available` | `missing` | `undecodable` | `unreadable`
- `is_expected_user_action`: `true` for logout, account deletion, signup/retry abandon and password reset; `false` for expiry, missing/failed sessions and the `system_unspecified` sentinel

`session_reset` is captured before PostHog resets its identity. `system_unspecified` is a detectable
compatibility sentinel; no known production path should emit it. Supabase terminal codes are only
present when the SDK exposes a matching response and are never inferred from an API 401.

**iOS funnel idempotency guarantees:**

- `onboarding_started` fire once per `OnboardingFlow` instance (@State guard). Reset on view re-instantiation via `.id(appState.onboardingSessionID)` after abandon.
- `onboarding_abandoned` fire at most once per `OnboardingState` (state.hasAbandoned flag).
- `onboarding_resumed` fire once per instance, mutually exclusive with `onboarding_started` for same session.
- `welcome_viewed` fire once per **session** via `state.hasEmittedWelcomeViewed` on `OnboardingState`. Critical: guard live on state (not on `WelcomeStep` view) because `OnboardingFlow` tear down and re-create step views on every step change via `.id(state.currentStep)` — local `@State` guard would double-fire on back-nav.
- Email `signup_started` fire once per **session** via `state.hasEmittedSignupStarted` on `OnboardingState`. Social `signup_started` fire on each provider signup attempt from `SocialLoginSection`.
- `onboarding_step_completed` for `budget_preview` fire once per session via `state.hasEmittedBudgetPreviewCompleted`. Prevent rapid-double-tap and retry-after-error from double-firing funnel event; CTA also disable once `state.readyToComplete` or `state.isSubmitting` true.

## Properties

**Global properties** (sent with every iOS event):

```
environment: 'local' | 'preview' | 'production'
app_version: string
build_number: string
platform: 'ios'
```

```typescript
// Use snake_case, be specific
captureEvent("budget_created", {
  has_pay_day: true,
  charges_count: 5,
  signup_method: "google",
});
```

## Rules

1. Always `snake_case`
2. Format: `object_action` in past tense (`signup_completed`, `budget_created`, `welcome_viewed`). Follow [Segment Tracking Plan spec](https://segment.com/docs/connections/spec/semantic/) used by Mixpanel, Amplitude, and PostHog's own SDK examples (`user_signed_up`). Events represent things that _already happened_, so past tense read naturally. PostHog's best-practices page contradict itself on tense — ignore it, trust examples.
3. Be specific: `budget_created` not `created`
4. Flow markers: `_started`, `_completed`, `_cancelled`, `_abandoned`, `_resumed`, `_failed`
5. Event names static strings — never interpolated (`page_viewed_${name}` forbidden; use fixed name + property)
6. Keep iOS and web funnels in sync when possible so cross-platform insights stay comparable
7. Properties also use `snake_case`. Value spaces documented in catalog above (e.g. `method` always `email | apple | google | biometric`)
