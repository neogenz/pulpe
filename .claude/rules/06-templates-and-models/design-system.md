---
description: "CSS architecture, design tokens, and utility classes"
paths:
  - "frontend/**/*.scss"
  - "frontend/**/*.css"
---

# Design System

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       CONSUMPTION                               │
│  Angular Templates          SCSS Classes (.text-*, .bg-*)       │
├─────────────────────────────────────────────────────────────────┤
│                       EXPOSITION                                │
│  CSS Variables: --p-primary, --p-fontsize-*, --p-spacing-*      │
├─────────────────────────────────────────────────────────────────┤
│                       DEFINITION                                │
│  Design tokens (primitive → semantic → components)              │
├─────────────────────────────────────────────────────────────────┤
│                       FOUNDATION                                │
│  Tailwind v4 + Angular Material                                 │
└─────────────────────────────────────────────────────────────────┘
```

## SCSS Utility Classes

Custom classes reference design token vars (no hardcoded values):

```scss
@layer utilities {
  .text-success { color: var(--p-success); }
  .bg-warning { background-color: var(--p-warning); }
}
```

| File | Classes |
|------|---------|
| `_tailwind-colors.scss` | `.text-success`, `.bg-info`, `.border-danger` |
| `_tailwind-typography.scss` | `.text-heading-lg`, `.text-body-md` |
| `_tailwind-radius.scss` | `.rounded-sm`, `.rounded-md` |
| `_tailwind-shadow.scss` | `.shadow-sm`, `.shadow-lg` |

## CSS Layers (Specificity)

```
theme     (base variables)            → Low priority
base      (Tailwind styles)
utilities (.text-*, .bg-* classes)    → High priority
```

Utilities win via `@layer utilities`.

## Styles in Components

### Inline SCSS (prefer small components)

```typescript
@Component({
  styles: `
    :host {
      display: block;
      padding: var(--p-spacing-4);
    }
    .card {
      background: var(--p-surface-0);
      border-radius: var(--p-border-radius-sm);
    }
  `
})
```

### Utility classes in templates

```html
<div class="bg-success-subtle text-success-dark p-4 rounded-sm">
  Success message
</div>
```

## Available Tokens

### Semantic Colors

| Token | CSS Variable | Usage |
|-------|--------------|-------|
| `primary` | `--p-primary` | Main color |
| `success` | `--p-success` | Validation, success |
| `info` | `--p-info` | Information |
| `warning` | `--p-warning` | Warning |
| `danger` | `--p-danger` | Error, destructive |

### Typography

`--p-fontsize-display-lg` (62px) · `--p-fontsize-heading-xl` (38px) · `--p-fontsize-heading-lg` (26px) · `--p-fontsize-body-md` (16px)

### Spacing

`--p-spacing-1` (4px) · `--p-spacing-4` (16px) · `--p-spacing-6` (24px)

### Border Radius

`--p-border-radius-xs` (4px) · `--p-border-radius-sm` (8px) · `--p-border-radius-md` (12px)

## Pulpe Semantic Tokens

### Layout Rhythm

| Token | CSS Variable | Value |
|-------|--------------|-------|
| `page-gutter-mobile` | `--pulpe-page-gutter-mobile` | `16px` |
| `page-gutter-tablet` | `--pulpe-page-gutter-tablet` | `24px` |
| `page-gutter-desktop` | `--pulpe-page-gutter-desktop` | `32px` |
| `section-gap-sm` | `--pulpe-section-gap-sm` | `16px` |
| `section-gap-md` | `--pulpe-section-gap-md` | `24px` |
| `section-gap-lg` | `--pulpe-section-gap-lg` | `32px` |

### Surfaces

| Token | CSS Variable | Value |
|-------|--------------|-------|
| `neutral-warm` | `--pulpe-neutral-warm` | `#F7F6F3` (DA §3.1 reference) |
| `surface-radius-card` | `--pulpe-surface-radius-card` | `24px` |
| `surface-radius-panel` | `--pulpe-surface-radius-panel` | `16px` |
| `surface-border-subtle` | `--pulpe-surface-border-subtle` | `1px solid var(--mat-sys-outline-variant)` |

Content zone background = neutral warm, never green-tinted. Generate Material neutral palette with desaturated seed (see DA.md §8.2).

### Motion

| Token | CSS Variable | Value |
|-------|--------------|-------|
| `motion-fast` | `--pulpe-motion-fast` | `150ms` |
| `motion-base` | `--pulpe-motion-base` | `220ms` |
| `motion-slow` | `--pulpe-motion-slow` | `320ms` |
| `ease-standard` | `--pulpe-ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `ease-emphasized` | `--pulpe-ease-emphasized` | `cubic-bezier(0.22, 1, 0.36, 1)` |

### Financial Semantics

- Use semantic financial tokens only (`--pulpe-financial-*`).
- No hardcoded financial hex in components.
- Financial token values map to Material system tokens for theme consistency.

**Category tokens (normal, planned) vs State tokens (consumption feedback):**

| Concept | Color | Token | When to use |
|---------|-------|-------|-------------|
| Income (category) | Blue / Tertiary | `--pulpe-financial-income` | Budget lines, pills, amounts |
| Expense (category) | Amber | `--pulpe-financial-expense` | Budget lines, pills, amounts, individual transactions |
| Savings (category) | Green / Primary | `--pulpe-financial-savings` | Budget lines, pills, amounts |
| Negative (moderate state) | Amber | `--pulpe-financial-negative` | Negative rollover, tight month |
| Near-limit (state, 80–99%) | Dark gold | `--pulpe-financial-near-limit` | Budget envelope approaching limit |
| Over-budget (state, >100%) | Amber | `--pulpe-financial-over-budget` | Budget envelope overrun |
| Deficit (critical state) | Red / Error | `--pulpe-financial-critical` | Hero section in deficit |

- Amber = both **category** (expense) AND **state** (near-limit, over-budget)
- Red = **critical state** only (deficit)
- State colors apply only to expense lines with active consumption (income/saving always `healthy`)
- No `text-error` / `bg-error-container` for individual expense amounts or transaction rows
- Red reserved for hero deficit display only

### Visual Zones

Screen split in two zones (see DA.md §3.1):

- **Emotion zone** (hero, header ~30-35% top): colored background matching financial state
- **Content zone** (lists, cards, forms): neutral warm background, never green-tinted
- Zone transition: soft gradient (40-60px), not hard cut
- Green = accents and actions only. Does NOT color neutral surfaces.
- **Screens without hero** (templates, settings, forms): no emotion zone. Neutral warm fills full screen. Identity from accents and tone of voice.

### Buttons

| Variant | Style | When |
|---------|-------|------|
| Primary | Filled green (primary) | Single dominant CTA per screen |
| Secondary | Outlined | Alternative actions, cancel, back |
| Text | Text button (no background) | Inline navigation, tertiary actions |
| Destructive | Text red or filled red | Delete, logout — always with confirmation |

- One primary button per screen or dialog
- Destructive buttons never first visual option
- Mobile: primary buttons min 48pt height (touch target)

## State Card Spec

- Component: `pulpe-state-card`
- Inputs: `variant: 'error' | 'empty' | 'loading'`, `title`, `message`, optional `actionLabel`.
- Optional: disabled action state via `actionDisabled`.
- Structure:
  - icon/spinner
  - title (single clear statement)
  - message (one actionable sentence)
  - optional action button aligned to end

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `color: #6366F1` | `color: var(--p-primary)` |
| `font-size: 26px` | `font-size: var(--p-fontsize-heading-lg)` |
| `padding: 16px` | `padding: var(--p-spacing-4)` |
| `ngClass` / `ngStyle` | `[class]` / `[style]` bindings |

## Reference

See project design system docs for full token list and customization.