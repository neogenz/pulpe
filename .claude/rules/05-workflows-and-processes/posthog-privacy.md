---
description: PostHog recording privacy — defence in depth for authenticated replays
paths:
  - "frontend/**/*.{ts,html,scss}"
---

# PostHog Recording Privacy

## Rule

**ALWAYS** add `ph-no-capture` CSS class to elements displaying sensitive financial amounts or user-entered business text.

The class does **two** jobs, and the second one is the reason it must never be renamed.

1. **Blur on demand.** `AmountsVisibilityService` toggles "hide amounts" (screen-sharing mode); the global rule in `styles.scss` applies `filter: blur()` + `pointer-events: none` to `.ph-no-capture` elements when `body.amounts-hidden` is active.
2. **Defence-in-depth replay exclusion.** posthog-js hardcodes `ph-no-capture` as rrweb's `blockClass`. Blocked elements are replaced by an empty placeholder of the same size before the local replay sanitizer runs.

Consequences:

- Never bind the class conditionally (`[class.ph-no-capture]="…"`) on an element that renders an amount: the replay stops being blocked whenever the expression is false.
- Never rename the class to match the blur feature. `session_recording` in `core/analytics/posthog.ts` masks every text node and input, blocks URL-bearing DOM nodes, and rebuilds uncompressed rrweb events through a fail-closed schema before sending. `ph-no-capture` remains an earlier, independent barrier for rendered amounts and business text.
- Never weaken `maskTextSelector: '*'`, `maskAllInputs: true`, the replay block selector, `compress_events: false`, or the strict `$snapshot` sanitizer without a privacy review against the exact installed `posthog-js` version.
- Keep native `posthog-js` `autocapture` disabled. Pulpe's authenticated click tracking uses the structure-only listener in `core/analytics/posthog.ts`, which emits `$autocapture` with tag names and numeric sibling positions only. It must never read or forward DOM text, input values, classes, IDs, selectors, URLs, attributes, or `data-ph-capture-attribute-*`; `before_send` rebuilds the same allowlisted structure as a second barrier.

## Email identity contract

Plain-text email is intentionally retained only as a PostHog person property
through `identify` / `$set`, so PostHog people can be reconciled with Supabase
users. `sanitizePersonProperties` restores this explicitly allowlisted scalar.

Every other email occurrence is accidental PII duplication. `email` therefore
remains in `SENSITIVE_EXACT_KEYS` and must be removed from ordinary event
properties, `$set_once`, and exception context. Never pass an email through a
`captureEvent` payload expecting it to survive.

## What to mark

Any element that renders a monetary value or sensitive user-entered text:

- Budget line amounts (planned, consumed, remaining, balance)
- Account balances and ending balances
- Transaction amounts
- Summary totals (available to spend, savings, income)
- Transaction and budget-line names (user-entered, may contain personal info)

## How to apply

Wrap **only the amount text** in a `<span class="ph-no-capture">`, or add the class to the closest non-interactive wrapper:

```html
<!-- CORRECT — class on a display-only span -->
<span class="ph-no-capture">
  {{ line.amount | appCurrency: currency() : '1.2-2' }}
</span>

<!-- CORRECT — class on a display-only div -->
<div class="ph-no-capture text-headline-medium font-bold">
  {{ totalAmount | appCurrency: currency() : '1.0-0' }}
</div>
```

## Do NOT put `ph-no-capture` on interactive elements

`pointer-events: none` propagates to the element itself. Buttons and links with `ph-no-capture` become unclickable.

```html
<!-- WRONG — button becomes unclickable when amounts are hidden -->
<button class="ph-no-capture" (click)="doSomething()">
  {{ tx.amount | appCurrency: currency() : '1.2-2' }}
</button>

<!-- CORRECT — only the amount text is wrapped -->
<button (click)="doSomething()">
  <mat-icon>receipt_long</mat-icon>
  <span class="ph-no-capture">
    {{ tx.amount | appCurrency: currency() : '1.2-2' }}
  </span>
</button>
```

For `mat-form-field` (amount inputs), the `ph-no-capture` class blurs the value but a CSS override in `styles.scss` preserves `pointer-events: auto` so users can still type.

## Reference

- Currency formatting (`appCurrency`, dual decimal policy): `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md`
- Global CSS: `frontend/projects/webapp/src/styles.scss` (search `amounts-hidden`)
- Service: `AmountsVisibilityService` in `core/amounts-visibility/`
- Toggle: settings page amount visibility toggle
- Exemption: add `amounts-visible` class on a `.ph-no-capture` element to exclude it from blur
