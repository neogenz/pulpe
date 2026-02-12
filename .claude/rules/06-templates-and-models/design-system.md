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

Custom classes reference design token variables (no hardcoded values):

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

Utility classes win thanks to `@layer utilities`.

## Styles in Components

### Inline SCSS (preferred for small components)

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
| `surface-radius-card` | `--pulpe-surface-radius-card` | `24px` |
| `surface-radius-panel` | `--pulpe-surface-radius-panel` | `16px` |
| `surface-border-subtle` | `--pulpe-surface-border-subtle` | `1px solid var(--mat-sys-outline-variant)` |

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
- Do not hardcode financial hex values in components.
- Financial token values must map to Material system tokens for theme consistency.

## State Card Spec

- Component: `pulpe-state-card`
- Inputs: `variant: 'error' | 'empty' | 'loading'`, `title`, `message`, optional `actionLabel`.
- Optional behavior: disabled action state via `actionDisabled`.
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

Refer to your project's design system documentation for the complete token list and customization options.
