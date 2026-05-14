<!-- SEED: re-run /impeccable document with IMPECCABLE_CONTEXT_DIR=landing once the landing page is stable to capture the actual tokens and component primitives. -->

---
name: Pulpe Landing
description: Next.js + Tailwind v4 marketing surface — calm naturalism, brighter palette, Poppins single-family. Inherits cross-platform DA from ../DESIGN.md.
---

# Design System: Pulpe Landing (Next.js)

> **Doc graph**
>
> - **Strategic foundation:** [../PRODUCT.md](../PRODUCT.md)
> - **Cross-platform visual common:** [../DESIGN.md](../DESIGN.md) — read first; this file inherits everything there
> - **This file:** Landing extensions — Poppins single-family, hero compositions, marketing CTAs, brand-tinted shadows, mild bounce
> - **Sibling platforms:** [../ios/DESIGN.md](../ios/DESIGN.md), [../frontend/DESIGN.md](../frontend/DESIGN.md)
> - **Sidecar:** TODO `landing/.impeccable/design.json` — generate via `/impeccable document` with `IMPECCABLE_CONTEXT_DIR=landing`

This is a **seed**. The landing is poster-flat marketing — single font family, brighter background, lift-on-hover micro-interactions. Until a full extraction pass is run, treat the cross-platform [DESIGN.md](../DESIGN.md) as the source of truth and the rules below as the diffs that already differ from the app.

## 1. Overview: Poster-Flat Marketing

Pulpe landing is Next.js + Tailwind v4. Marketing-first: long-form hero, copywriting-driven sections, CTAs that lift slightly on hover. **Desktop responsive**, never mobile-first — landing pages are visited from a laptop more often than from a phone.

**Landing-specific characteristics:**
- **Single font family:** Poppins. No display/body split. The system body font commitment from cross-platform DESIGN.md does not apply here.
- **Brighter canvas:** `#F6FFF0` (slightly cooler than the app's `#F7F6F3` warm canvas) — landing breathes more.
- **Brand-tinted shadows:** `rgba(0, 60, 20, 0.06)` instead of generic black-on-low-opacity.
- **Mild bounce permitted:** `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` for hover lifts on CTAs and feature cards. **Landing only** — never in the app.

## 2. Colors

The brand seeds match `../DESIGN.md` (`#006E25`, `#0061A6`, etc.). Landing-specific overrides:

- **Canvas:** `#F6FFF0` — brighter than the app, cooler tint. Marketing wants air.
- **CTA fill:** Pulpe Forest `#006E25`, identical to app primary.
- **Brand-tinted shadow:** `rgba(0, 60, 20, 0.06)` for cards, hero composites, CTAs.

Dark mode is **not implemented** on the landing (and probably won't be — marketing pages convert better in light mode for our audience).

## 3. Typography

- **Single family:** Poppins.
- **Hierarchy:** size + weight contrast. Display (700/800) for hero, body (400/500) for paragraphs, label (600 small caps) for kicker labels above headlines.
- **Numbers:** `font-variant-numeric: tabular-nums` on any amount or stat.

The cross-platform `Two-Family Rule` from `../DESIGN.md` permits one family on simple surfaces — landing is exactly that.

## 4. Elevation

Cards lift slightly on hover via the bounce ease-spring. Otherwise flat — same `Flat-By-Default Rule` as cross-platform DESIGN.md.

### Shadow Vocabulary
- **Card rest:** `0 4px 12px rgba(0, 60, 20, 0.06)` — brand-tinted, very soft.
- **Card hover:** `0 8px 24px rgba(0, 60, 20, 0.10)` + `transform: translateY(-2px)`.

## 5. Components

- **Hero CTA:** Solid Pulpe Forest fill, white text, capsule (`border-radius: 9999px`), Poppins 600 17px, `padding: 18px 32px`. Hover lifts `translateY(-2px)` over `--ease-spring`.
- **Feature card:** White surface, `border-radius: 24px`, brand-tinted rest shadow, hover lift.
- **Kicker label:** Poppins 600 13px, uppercase, `letter-spacing: 0.08em`. Used above section headlines.
- **Section spacing:** Vertical rhythm `120px` between major sections on desktop, `80px` on mobile breakpoints.

### Landing-Specific Named Rules

**The Mild Bounce Rule (landing only).** `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` is permitted on hover lifts and CTA presses on the landing page. The app never uses bounce — soft springs only. The landing earns its bounce because it is marketing, not a tool.

**The Single Family Rule (landing only).** Poppins covers display, body, button, label, kicker. No second font family is added. If a typographic distinction is needed, use weight + size + tracking, never a new family.

## 6. Do's and Don'ts (Landing-specific)

### Do:
- **Do** use Poppins for everything — display, body, button, label.
- **Do** use brand-tinted shadows (`rgba(0, 60, 20, 0.06)`), never generic black-on-low-opacity.
- **Do** add the `--ease-spring` lift on CTA and feature card hover — landing is allowed to feel a little bouncy.
- **Do** consult [../DESIGN.md](../DESIGN.md) for any rule not landing-specific — this file is extensions only.

### Don't:
- **Don't** add a second font family. Landing is single-family.
- **Don't** ship dark mode — landing is light only by design choice.
- **Don't** use the bounce ease-spring outside the landing — the app stays calm.
- **Don't** use generic black shadows — every shadow is brand-tinted.
- **Don't** make the landing mobile-first — it is desktop-responsive, not mobile-up.

---

**Status:** seed (placeholder, partial coverage). Run `/impeccable document` with `IMPECCABLE_CONTEXT_DIR=landing` to fully extract tokens, generate the Stitch frontmatter, and produce the sidecar.
