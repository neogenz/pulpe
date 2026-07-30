<!-- SEED: re-run /impeccable document with IMPECCABLE_CONTEXT_DIR=landing once the landing page is stable to capture the actual tokens and component primitives. -->

---

name: Pulpe Landing
description: Next.js + Tailwind v4 marketing surface — calm naturalism, native system typography, product-led composition. Inherits cross-platform DA from ../DESIGN.md.

---

# Design System: Pulpe Landing (Next.js)

> **Doc graph**
>
> - **Strategic foundation:** [../PRODUCT.md](../PRODUCT.md)
> - **Cross-platform visual common:** [../DESIGN.md](../DESIGN.md) — read first; this file inherits everything there
> - **This file:** Landing extensions — native typography, hero composition, marketing CTA, tonal fields and restrained motion
> - **Sibling platforms:** [../ios/DESIGN.md](../ios/DESIGN.md), [../frontend/DESIGN.md](../frontend/DESIGN.md)
> - **Sidecar:** TODO `landing/.impeccable/design.json` — generate via `/impeccable document` with `IMPECCABLE_CONTEXT_DIR=landing`

This is a **seed**. The landing is poster-flat marketing: single font family, generous editorial rhythm and one product-led motion sequence. The cross-platform [DESIGN.md](../DESIGN.md) remains the source of truth.

## 1. Overview: Product-Led Calm

Pulpe landing is Next.js + Tailwind v4. Marketing-first: a large promise, a wide product proof, then alternating editorial and product modules. Desktop has the broadest composition; every module still collapses deliberately on mobile.

**Landing-specific characteristics:**

- **Single font stack:** `-apple-system`, `system-ui`, `SF Pro Display`, `SF Pro Text`, `Helvetica Neue`, Arial, sans-serif. No display/body split and no downloaded webfont.
- **Two-zone canvas:** the warm `#F7F6F3` base carries the content. Desktop uses a shared radial field; below `768px`, the hero and opening narrative use paired, section-scoped green ellipses whose blur overlaps the transition.
- **Product signature:** the live annual-budget dashboard is the one memorable visual moment.
- **Brand-tinted elevation:** `rgba(0, 60, 20, 0.06)` instead of generic black shadows.
- **Restrained motion:** `--ease-smooth`, 150–300 ms interactions and no overshoot.
- **Glass boundary:** translucent blur belongs to the floating navbar only, never content cards.

## 2. Colors

The semantic brand seeds match `../DESIGN.md` (`#006E25`, `#0061A6`, etc.). Landing-specific surfaces:

- **Canvas:** `#F7F6F3` below the hero emotion field.
- **Surface:** `#FFFEFA`, a warm near-white rather than raw white.
- **Tonal surface:** `#EAF6E6`, reserved for calm grouping and positive context.
- **CTA fill:** Pulpe Forest `#006E25`.
- **Brand-tinted shadow:** `rgba(0, 60, 20, 0.06)`.

Dark mode follows the system appearance; the landing has no manual theme toggle.

## 3. Typography

- **Single stack:** native Apple/system typography, with SF Pro when available.
- **Hierarchy:** 760 for display; 400/500 for body; 700 for controls.
- **Tracking:** `-0.06em` for the large editorial display, `-0.02em` for controls.
- **Scale:** hero `clamp(4.15rem, 8.5vw, 7.6rem)` at `0.86`; section titles `clamp(2.85rem, 6.4vw, 5.6rem)` at `0.96`. At `620px`, use `clamp(3.8rem, 18vw, 5.6rem)` and `clamp(2.7rem, 13vw, 4.2rem)`.
- **Measure:** body copy targets 65–75 characters per line on desktop.
- **Wrapping:** balance headlines, pretty-wrap paragraphs.
- **Kickers:** sentence case and exceptional, never automatic section decoration.
- **Numbers:** `font-variant-numeric: tabular-nums` for every amount or stat.

## 4. Elevation

Content is flat by default. A surface uses tone, a hairline outline or a short shadow; it does not combine a structural border with a wide diffuse shadow.

- **Card rest:** `0 6px 18px rgba(0, 60, 20, 0.06)` when elevation is required.
- **Card hover:** `0 10px 24px rgba(0, 60, 20, 0.09)` and at most `translateY(-2px)` on interactive elevated surfaces.
- **Radius:** 16 px for content surfaces; nested radii stay concentric.

## 5. Components

- **Hero CTA:** solid Pulpe Forest capsule, system 700, hover lift over `--ease-smooth`, exact press feedback `scale(0.96)`.
- **Feature surface:** tonal or near-white, `border-radius: 16px`, no glass.
- **Navbar:** floating full-width pill, one translucent layer, 44 px minimum targets, compact CTA below `720px`.
- **Section spacing:** adjacent default sections share 120 px on desktop and 80 px on mobile. The `Section` primitive contributes half of that boundary on each side; do not apply the full value twice.

### Landing-Specific Named Rules

**The Visible-Default Rule.** Marketing content is present and visible in server HTML. Motion may enhance the hero or a real sequence, but scroll position never determines whether copy or product proof can be read.

**The Navigation Glass Rule.** Backdrop blur and translucent shine are reserved for the floating navbar. Content surfaces use tone, outline or restrained elevation.

**The Single Family Rule.** The native system stack covers display, body, button and label. Distinction comes from scale, weight and spacing, never a downloaded or second family.

**The Mobile Diffuse Field Rule.** Below `768px`, keep the body neutral and place two blurred brand-green ellipses inside both the hero and opening narrative. Their source colors use denser mobile ambient tokens so the `150px` blur does not wash them out; opposite sides keep distinct leaf and mint hues. Offset them to opposite sides and ends of each section, let them overflow their internal boundary and clip only at the outer canvas so their fade bridges the content blocks. No neutral vertical stripe, decorative grid, glass panel or hard gradient edge.

## 6. Do's and Don'ts

### Do:

- **Do** use a single wide product demonstration as the hero signature.
- **Do** use `--ease-smooth` for targeted 150–300 ms interactions.
- **Do** keep one dominant CTA per conversion moment.
- **Do** consult [../DESIGN.md](../DESIGN.md) for any rule not landing-specific.

### Don't:

- **Don't** hide marketing copy behind scroll reveals.
- **Don't** apply the same fade, kicker or card treatment to every section.
- **Don't** use glass on cards, equal card grids, decorative two-axis grids or grain overlays on the home page.
- **Don't** add a second font family or a manual theme toggle.

---

**Status:** seed (partial coverage). Run `/impeccable document` with `IMPECCABLE_CONTEXT_DIR=landing` once the landing is stable.
