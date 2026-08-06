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
│  CSS Variables: --mat-sys-*, --pulpe-*, Tailwind @theme         │
├─────────────────────────────────────────────────────────────────┤
│                       DEFINITION                                │
│  Design tokens (primitive → semantic → components)              │
├─────────────────────────────────────────────────────────────────┤
│                       FOUNDATION                                │
│  Tailwind v4 + Angular Material                                 │
└─────────────────────────────────────────────────────────────────┘
```

## SCSS Utility Classes

Custom classes are declared with the Tailwind v4 `@utility` directive and reference design
token vars (no hardcoded values):

```css
@utility text-financial-expense {
  color: var(--pulpe-financial-expense) !important;
}
```

All of them live in a single file, `app/styles/vendors/_tailwind.css`:

| Group | Classes |
|-------|---------|
| Typography (M3 typescale) | `.text-display-large` … `.text-label-small` |
| Financial colors | `.text-financial-income`, `.text-financial-expense`, `.text-financial-savings`, `.text-financial-critical`, `.text-financial-over-budget` |
| Icons | `.icon-filled`, `.mat-icon-sm`, `.form-field-error-icon` |
| Misc | `.scrollbar-hide` |

Colors, radius and type otherwise come from stock Tailwind utilities, wired to Material
through the `@theme inline` block in the same file (`--color-*`, `--radius-corner-*`,
`--text-*`). Shadows are not in that block — Tailwind's own `shadow-*` scale applies.

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
      padding: var(--pulpe-page-gutter-mobile);
    }
    .card {
      background: var(--mat-sys-surface-container);
      border-radius: var(--pulpe-surface-radius-card);
    }
  `
})
```

### Utility classes in templates

```html
<div class="bg-surface-container text-on-surface-variant p-4 rounded-corner-medium">
  Message
</div>
```

## Available Tokens

### Semantic Colors

The base palette is the M3 system palette — there is no `success` / `info` / `danger` layer.

| Role | CSS Variable | Tailwind class |
|------|--------------|----------------|
| Main color | `--mat-sys-primary` | `text-primary`, `bg-primary` |
| Accent | `--mat-sys-tertiary` | `text-tertiary` |
| Error, destructive | `--mat-sys-error` | `text-error`, `bg-error` |
| Surfaces | `--mat-sys-surface`, `--mat-sys-surface-container` | `bg-surface-container` |
| Text on surface | `--mat-sys-on-surface`, `--mat-sys-on-surface-variant` | `text-on-surface-variant` |

Domain colors (income, expense, savings, budget states) live in the `--pulpe-financial-*`
namespace — see **Financial Semantics** below.

### Typography

M3 typescale, exposed as `--mat-sys-<role>-<size>` and consumed through the Tailwind
utilities defined in `_tailwind.css`:

`.text-display-large` · `.text-headline-large` · `.text-title-medium` · `.text-body-medium` · `.text-label-small`

### Spacing

Stock Tailwind spacing scale (`p-4`, `gap-6`, …) — the project defines no custom spacing
variables. Page rhythm uses the `--pulpe-page-gutter-*` / `--pulpe-section-gap-*` tokens
below.

### Border Radius

`--mat-sys-corner-extra-small` (4px) · `--mat-sys-corner-small` (8px) · `--mat-sys-corner-medium` (12px) · `--mat-sys-corner-large` (16px) · `--mat-sys-corner-extra-large` (28px) · `--mat-sys-corner-full` (9999px)

Tailwind equivalents: `rounded-corner-small`, `rounded-corner-medium`, …

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
| `neutral-warm` | `--pulpe-neutral-warm` | `#F7F6F3` (`DESIGN.md` §2 reference) |
| `surface-radius-card` | `--pulpe-surface-radius-card` | `24px` |
| `surface-radius-panel` | `--pulpe-surface-radius-panel` | `16px` |
| `surface-border-subtle` | `--pulpe-surface-border-subtle` | `1px solid var(--mat-sys-outline-variant)` |

Content zone background = neutral warm, never green-tinted. Generate the Material neutral palette from the desaturated seed documented in `frontend/DESIGN.md` §2.

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

Screen split in two zones (see `DESIGN.md` §2, **The Two-Zone Rule**):

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
| `color: #6366F1` | `color: var(--mat-sys-primary)` |
| `font-size: 26px` | the nearest typescale class — `text-headline-small` (24px) or `text-headline-medium` (28px), never a px in between |
| `padding: 16px` | `class="p-4"` or `var(--pulpe-page-gutter-mobile)` |
| `ngClass` / `ngStyle` | `[class]` / `[style]` bindings |

## Reference

See project design system docs for full token list and customization.
