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

```
$pageview (landing) → cta_clicked → signup_completed → vault_code_setup_completed
→ onboarding_started → profile_step1_completed → profile_step2_completed → first_budget_created
```

## Events Catalog

### Landing Page Events

| Event | When | Properties |
|-------|------|------------|
| `$pageview` | Auto-captured on page load | `$current_url` |
| `cta_clicked` | User clicks CTA button | `cta_name`, `cta_location`, `destination` |

### Auth Flow Events

| Event | When | Properties |
|-------|------|------------|
| `signup_started` | User clicks signup button | `method` |
| `signup_completed` | Email signup succeeds | `method` |
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

## Properties

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
