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
app_opened → welcome_screen_viewed → signup_started → onboarding_step_completed (×3)
→ signup_completed → pin_setup_completed → budget_created → transaction_created
```

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
| `first_budget_created` | User creates initial budget | `signup_method`, `has_pay_day`, `charges_count` |

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
| `welcome_screen_viewed` | Welcome screen appears (new user) | — |
| `signup_started` | "Commencer" tapped on welcome | `method` (`email`) |
| `onboarding_step_completed` | User completes onboarding step | `step` (`personal_info` \| `expenses` \| `budget_preview`) |
| `signup_completed` | Registration succeeds | `method` (`email`) |
| `login_completed` | Login succeeds | `method` (`email` \| `biometric`) |
| `pin_setup_completed` | PIN created successfully | — |
| `pin_entered` | PIN entered on return visit | — |
| `budget_created` | Budget created | — |
| `transaction_created` | Transaction added | `type` (`expense` \| `income` \| `saving`) |
| `tab_switched` | User switches tab | `tab` (`currentMonth` \| `budgets` \| `templates`) |
| `logout_completed` | User logs out | — |

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
2. Format: `object_action` (noun + verb past tense)
3. Be specific: `budget_created` not `created`
4. Use `_started`, `_completed`, `_cancelled` for flows
