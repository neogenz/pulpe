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

## Existing Events

| Event | When |
|-------|------|
| `signup_started` | User clicks signup button |
| `signup_completed` | Email signup succeeds |
| `first_budget_created` | User creates initial budget |
| `profile_step1_completed` | First profile step done |
| `tutorial_started` | Tutorial begins |
| `tutorial_completed` | Tutorial finished |
| `tutorial_cancelled` | User skips tutorial |

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