---
description: Integration patterns for Angular Material 21 + Tailwind v4 + Pulpe design tokens
paths:
  - "frontend/**/*.ts"
  - "frontend/**/*.html"
  - "frontend/**/*.scss"
  - "frontend/**/*.css"
---

# Material 21 + Tailwind 4 Integration

This project uses a **3-layer token system** where Tailwind bridges to Material system tokens, and Pulpe semantic tokens sit on top.

## Token Hierarchy

```
┌─────────────────────────────────────────────┐
│  Pulpe Semantic     --pulpe-financial-*      │  Domain-specific
│                     --pulpe-surface-*         │
│                     --pulpe-motion-*          │
├─────────────────────────────────────────────┤
│  Tailwind Theme     --color-primary          │  Tailwind utilities
│  (@theme inline)    --font-sans              │  (bg-primary, text-body-medium)
│                     --radius-corner-*        │
│                     --text-body-medium        │
├─────────────────────────────────────────────┤
│  Material System    --mat-sys-primary        │  Foundation (set by mat.theme())
│                     --mat-sys-body-large-*    │
│                     --mat-sys-corner-*        │
└─────────────────────────────────────────────┘
```

### Which Token to Use Where

| Context | Use | Example |
|---------|-----|---------|
| Tailwind class in template | Tailwind color names | `class="bg-primary text-on-surface"` |
| Tailwind typography utility | `@utility` classes | `class="text-body-medium text-headline-large"` |
| Component `:host` / SCSS | Pulpe tokens or `--mat-sys-*` | `background: var(--mat-sys-surface-container)` |
| Financial domain color | Pulpe financial tokens | `class="text-financial-income"` |
| Material component override | `mat.*-overrides()` mixin | `@include mat.dialog-overrides(...)` |
| Global layout | Pulpe layout tokens | `padding: var(--pulpe-page-gutter-mobile)` |

## Tailwind Theme Bridge

File: `styles/vendors/_tailwind.css`

Tailwind v4 `@theme inline` maps Tailwind tokens to Material system variables:

```css
@theme inline {
  /* Colors → Material system */
  --color-primary: var(--mat-sys-primary);
  --color-on-primary: var(--mat-sys-on-primary);
  --color-surface: var(--mat-sys-surface);
  --color-error: var(--mat-sys-error);
  /* ... full M3 color system */

  /* Financial → Pulpe semantic */
  --color-financial-income: var(--pulpe-financial-income);
  --color-financial-expense: var(--pulpe-financial-expense);

  /* Typography → Material typescale */
  --font-sans: var(--mat-sys-body-large-font), sans-serif;
  --font-display: var(--mat-sys-display-large-font), sans-serif;

  /* Border radius → Material shape */
  --radius-corner-small: var(--mat-sys-corner-small);
  --radius-corner-medium: var(--mat-sys-corner-medium);

  /* Typography scale → Material typescale (size, line-height, weight, tracking, font) */
  --text-body-medium: var(--mat-sys-body-medium-size);
  --text-body-medium--line-height: var(--mat-sys-body-medium-line-height);
  /* ... full typescale */
}
```

This means `class="bg-primary"` resolves to `--mat-sys-primary` at runtime.

## Tailwind Custom Utilities

File: `styles/vendors/_tailwind.css`

Defined with `@utility` (Tailwind v4 syntax, NOT `@apply`):

```css
/* Typography (matches Material typescale) */
@utility text-display-large { font-size: var(--text-display-large); ... }
@utility text-body-medium { font-size: var(--text-body-medium); ... }
@utility text-label-small { font-size: var(--text-label-small); ... }

/* Financial colors (need !important to override Material defaults) */
@utility text-financial-income { color: var(--pulpe-financial-income) !important; }
@utility text-financial-expense { color: var(--pulpe-financial-expense) !important; }

/* Icon utilities */
@utility icon-filled { font-variation-settings: "FILL" 1; }
@utility mat-icon-sm { font-size: 1.125rem !important; }
```

## Component Template Pattern

Mix Tailwind utilities + Material components:

```html
<!-- Layout with Tailwind, form with Material -->
<form class="flex flex-col gap-6 min-w-0 px-1">
  <mat-form-field subscriptSizing="dynamic" class="w-full">
    <mat-label>Nom</mat-label>
    <input matInput formControlName="name" />
  </mat-form-field>

  <div class="flex gap-2">
    <button matButton="outlined" (click)="cancel()">Annuler</button>
    <button matButton="filled" (click)="save()">Enregistrer</button>
  </div>
</form>
```

Rules:
- **Tailwind** for layout (`flex`, `gap-*`, `w-full`, `p-*`, `min-w-0`)
- **Material components** for interactive UI (`mat-form-field`, `matButton`, `mat-select`)
- **Tailwind color classes** for text and backgrounds (`text-on-surface-variant`, `bg-surface-container`)
- **NEVER** hardcode colors or spacing in templates

## Material Component Overrides

Use `mat.*-overrides()` SCSS mixins in global `styles/*.scss` files. **NEVER** use `::ng-deep`.

```scss
@use "@angular/material" as mat;

// Dialog: surface-container-high background (M3 spec)
html {
  @include mat.dialog-overrides((
    container-color: var(--mat-sys-surface-container-high),
  ));
}

// Tabs: 3px indicator per M3 spec
[fitInkBarToContent] > .mat-mdc-tab-header {
  @include mat.tabs-overrides((
    active-indicator-shape: 3px 3px 0 0,
    active-indicator-height: 3px,
  ));
}

// Stepper: transparent container, themed icons
.complete-profile-stepper {
  @include mat.stepper-overrides((
    container-color: transparent,
    header-edit-state-icon-background-color: var(--mat-sys-primary),
    header-done-state-icon-background-color: var(--mat-sys-primary),
  ));
}

// Warn theme: swap primary to error
[color="warn"], .warn-theme {
  @include mat.theme-overrides((
    primary: var(--mat-sys-error),
    on-primary: var(--mat-sys-on-error),
  ));
}
```

### Token Lookup Procedure

When you need to override a Material component's styles, **look up the available tokens** from the local install instead of guessing:

**Step 1 — Find the token source file:**
```
frontend/node_modules/@angular/material/<component>/_m3-<component>.scss
```

Component folder names: `autocomplete`, `badge`, `bottom-sheet`, `button`, `button-toggle`, `card`, `checkbox`, `chips`, `datepicker`, `dialog`, `divider`, `expansion`, `form-field`, `grid-list`, `icon`, `input`, `list`, `menu`, `paginator`, `progress-bar`, `progress-spinner`, `radio`, `select`, `sidenav`, `slide-toggle`, `slider`, `snack-bar`, `sort`, `stepper`, `table`, `tabs`, `timepicker`, `toolbar`, `tooltip`, `tree`.

**Step 2 — Read the `get-tokens()` function.** It returns a Sass map with 4 sections:
- `base:` — shape, sizing, layout (non-themed)
- `color:` — all color tokens (state layers, text, containers)
- `typography:` — font family, size, weight, tracking, line-height
- `density:` — height/sizing at different density scales

**Step 3 — Strip the component prefix** to get the override key name. Tokens are prefixed with the component namespace (listed in `_define-overrides()` in `_<component>-theme.scss`):

| Token in `_m3-<component>.scss` | Override key | Namespace |
|--------------------------------|--------------|-----------|
| `chip-container-shape-radius` | `container-shape-radius` | `chip` |
| `dialog-container-color` | `container-color` | `dialog` |
| `dialog-subhead-font` | `subhead-font` | `dialog` |

**Step 4 — Use in the overrides mixin:**
```scss
@include mat.<component>-overrides((
  <key-without-prefix>: <value>,
));
```

**Example — looking up chip tokens:**
1. Read `frontend/node_modules/@angular/material/chips/_m3-chip.scss`
2. Find `chip-label-text-color: map.get($system, on-surface-variant)` in `color:`
3. Strip `chip-` → `label-text-color`
4. Override: `@include mat.chips-overrides((label-text-color: var(--mat-sys-primary)));`

> **Note:** The namespace (step 3) is usually the singular component name (`chip`, `dialog`, `tab`), confirmed by `_define-overrides()` in the `_<component>-theme.scss` file next to it.

## Density System

Use CSS classes `.density-N` (N = 1 to 5) to apply Material density:

```html
<!-- Compact form field -->
<div class="density-2">
  <mat-form-field>...</mat-form-field>
</div>
```

Generated in `styles/_sizes.scss` via `mat.theme((density: -N))`.

## Dark Theme

Three mechanisms work together:

| Mechanism | File | What it does |
|-----------|------|-------------|
| `color-scheme: light dark` on `html` | `styles.scss` | Enables browser-level dark color scheme |
| `.dark-theme { color-scheme: dark }` | `styles/themes/_dark.scss` | Class-based toggle |
| `@custom-variant dark` | `_tailwind.css` | Tailwind `dark:` variant scoped to `.dark-theme` |
| `@media (prefers-color-scheme: dark)` | Various | System preference fallback |

```css
/* Tailwind v4 custom dark variant */
@custom-variant dark (&:where(.dark-theme, .dark-theme *));
```

This means `class="dark:bg-surface-container"` activates when `.dark-theme` is on an ancestor.

## Font Loading

Self-hosted via `@fontsource` (NOT Google Fonts CDN):

| Font | Role | Material mapping |
|------|------|-----------------|
| DM Sans | Body text (`plain-family`) | `--mat-sys-body-*-font` |
| Manrope | Headings (`brand-family`) | `--mat-sys-display-*-font` |

Loaded in `styles.scss` via `@include meta.load-css("@fontsource/...")`.

## Tailwind + Material Compatibility Fix

```css
/* Fix: Tailwind border reset breaks Material outline form field */
.mdc-notched-outline__notch {
  border-style: none;
}

/* Fix: Tailwind line-height reset breaks Material icon buttons */
.mat-mdc-icon-button {
  line-height: 1;
}
```

These live in `_tailwind.css` and are critical — do not remove.

## ngm-dev/cli

Several style files come from `https://ui.angular-material.dev/api/registry/` via `@ngm-dev/cli`. Do not manually rewrite files marked with "Installed from" comments — use `@ngm-dev/cli update` instead.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `::ng-deep .mat-*` | `@include mat.*-overrides(...)` in global SCSS |
| `color: #006E25` | `color: var(--mat-sys-primary)` or `class="text-primary"` |
| `font-size: 16px` | `class="text-body-medium"` or `font: var(--mat-sys-body-medium)` |
| `@apply bg-green-500` | `class="bg-primary"` (use semantic colors) |
| `border-radius: 12px` | `border-radius: var(--mat-sys-corner-medium)` or `class="rounded-corner-medium"` |
| Material override in component styles | Material override in `styles/*.scss` (global) |
| `@import "tailwindcss/utilities"` | `@import "tailwindcss"` (Tailwind v4 single import) |
| Google Fonts CDN link in index.html | `@fontsource` imports in `styles.scss` |
| `!important` in component styles | `!important` only in `@utility` definitions that override Material |
