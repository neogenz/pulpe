<!-- SEED: re-run /impeccable document with IMPECCABLE_CONTEXT_DIR=frontend once the webapp surface is stable to capture the actual tokens and component primitives. -->

---
name: Pulpe Webapp
description: Angular 21+ responsive desktop & mobile web — calm naturalism for personal budgeting in the browser. Inherits cross-platform DA from ../DESIGN.md.
---

# Design System: Pulpe Webapp (Angular)

> **Doc graph**
>
> - **Strategic foundation:** [../PRODUCT.md](../PRODUCT.md)
> - **Cross-platform visual common:** [../DESIGN.md](../DESIGN.md) — read first; this file inherits everything there
> - **This file:** Webapp extensions — Angular Material 21, Tailwind v4, CSS custom properties, responsive grid
> - **Sibling platforms:** [../ios/DESIGN.md](../ios/DESIGN.md), [../landing/DESIGN.md](../landing/DESIGN.md)
> - **Sidecar:** TODO `frontend/.impeccable/design.json` — generate via `/impeccable document` with `IMPECCABLE_CONTEXT_DIR=frontend`

This is a **seed**. The webapp tokens, component vocabulary, and Material overrides exist in code; this doc captures the strategic webapp-specific intent until a full extraction pass is run. Until then, treat the cross-platform [DESIGN.md](../DESIGN.md) as the source of truth and the snippets below as anchors for the patterns that already differ from iOS.

## 1. Overview: Three Token Layers

Pulpe webapp is Angular 21 (signals, zoneless, OnPush) + Material 21 (unified `matButton` directive) + Tailwind v4 (`@theme` configuration in CSS). Responsive desktop-first with mobile breakpoints. The token system is **three layers stacked**:

1. **Material foundation** (`--mat-sys-*`): Theme-only. Never read directly from features; only via Material component overrides.
2. **Tailwind utilities** (`text-primary`, `bg-surface`, `rounded-pill`, `gap-md`): Day-to-day chrome.
3. **Pulpe semantic** (`--pulpe-*`): Domain-aware variables — `--pulpe-financial-income`, `--pulpe-page-gutter-mobile`, `--pulpe-card-radius`. Resolves through Tailwind `@theme` to actual hex / px.

The Material foundation is generated from the same brand seeds as iOS (`#006E25`, `#0061A6`, etc.) plus a webapp-only neutral seed `#8A8A82` for warm Material palette generation. This neutral seed does **not** appear in iOS code — it's an Angular Material 3 input only.

## 2. Colors

The brand seeds match `../DESIGN.md`. Webapp-specific resolution adds:

- **Material neutral seed** (`#8A8A82`): generates the warm Material neutral ramp via `mat.theme()`. Webapp only.
- **Surface ramp:** Material 3 generated `--mat-sys-surface-container-*` levels. Mapped to `--pulpe-surface-*` semantic aliases for use in features.
- **Dark mode:** webapp uses `prefers-color-scheme: dark` with the Material 3 generated dark palette; tonal mapping is parallel to iOS but resolves to different concrete hex.

> **Source of truth:** `frontend/projects/webapp/src/styles/` — Material theme config, Tailwind `@theme` block, semantic `--pulpe-*` variables.

## 3. Typography

- **Display:** Manrope (`--mat-sys-brand-family`, `--brand-family`) — same role as iOS.
- **Body / UI:** DM Sans (`--mat-sys-plain-family`, `--plain-family`).
- **Numbers:** `font-variant-numeric: tabular-nums` everywhere amounts appear.

Two families on web, never three. Same `Two-Family Rule` as cross-platform DESIGN.md.

## 4. Elevation

Material 3 elevation system (`--mat-sys-level1` through `--mat-sys-level5`) plus Pulpe-specific brand-tinted shadows for branded surfaces. Same `Flat-By-Default Rule` as iOS — Material elevation is reserved for state (raised cards on hover, dialog surfaces) and not used decoratively.

## 5. Components

All Material components are themed via `mat.<component>-overrides()` mixins in global SCSS. **Never `::ng-deep`** — that's a hard ban in this codebase.

- **Buttons:** Material 21 unified `matButton` directive. Variants `filled` (primary CTA), `outlined` (secondary), `tonal` (low-emphasis), `text` (text-link). The legacy `mat-flat-button` / `mat-stroked-button` syntax is forbidden (Material 21 migration).
- **Form fields:** `matInput` with floating labels. Custom `--pulpe-input-*` overrides for brand consistency.
- **Cards:** Plain `<div>` with Tailwind utilities; `mat-card` is used only when its accessibility behaviors are required.
- **Chips:** TODO — chip vocabulary not yet extracted. The `PulpeChip` atom on iOS does not have a webapp counterpart yet. **Open question:** should we ship a shared web `<pulpe-chip>` Angular component, or rely on `mat-chip` with `--pulpe-*` overrides? Decide during the next extraction pass.

### Webapp-Specific Named Rules

**The No `::ng-deep` Rule.** Material component overrides go through `mat.<component>-overrides()` mixins in global SCSS. `::ng-deep` is **prohibited** anywhere in the codebase — it leaks styles across components and breaks Angular's encapsulation guarantees.

**The Material 21 Unified Button Rule.** All buttons use `matButton="filled"` / `"outlined"` / `"tonal"` / `"text"`. The pre-21 directive variants (`mat-flat-button`, `mat-stroked-button`, `mat-raised-button`) are deprecated and forbidden in new code.

## 6. Do's and Don'ts (Webapp-specific)

### Do:
- **Do** override Material via `mat.<component>-overrides()` mixins in global SCSS.
- **Do** use Tailwind v4 `@theme` to map `--pulpe-*` semantic variables to concrete values.
- **Do** use `tabular-nums` (`font-variant-numeric`) on every amount.
- **Do** consult [../DESIGN.md](../DESIGN.md) for any rule not webapp-specific — this file is extensions only.

### Don't:
- **Don't** use `::ng-deep` — ever.
- **Don't** mix the legacy Material button directives (`mat-flat-button`, etc.) — Material 21 unified `matButton` only.
- **Don't** read `--mat-sys-*` directly from features — go through `--pulpe-*` semantic aliases.
- **Don't** mix three font families — Manrope display + DM Sans body, max two.
- **Don't** apply elevation decoratively — flat by default, elevation is state.

---

**Status:** seed (placeholder, partial coverage). Run `/impeccable document` with `IMPECCABLE_CONTEXT_DIR=frontend` to fully extract tokens, generate the Stitch frontmatter, and produce the sidecar.
