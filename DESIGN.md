---
name: Pulpe
description: Calm naturalism for personal budgeting — warm neutrals, purposeful color, zero anxiety. Cross-platform strategic visual layer.
colors:
  pulpe-primary: "#006E25"
  pulpe-primary-on: "#FFFFFF"
  pulpe-secondary: "#406741"
  pulpe-tertiary: "#0061A6"
  financial-income: "#0061A6"
  financial-expense: "#B35800"
  financial-savings: "#157038"
  financial-over-budget: "#A86800"
  hero-comfortable: "#14AD45"
  hero-tight: "#D88010"
  hero-deficit: "#C45028"
  destructive: "#C62828"
  text-primary: "#1A1C19"
  app-background: "#F7F6F3"
typography:
  display:
    fontFamily: "Manrope"
    fontWeight: 800
  body-ios:
    fontFamily: "SF Pro"
    fontWeight: 400
  body-web:
    fontFamily: "DM Sans"
    fontWeight: 400
  body-landing:
    fontFamily: "Poppins"
    fontWeight: 400
---

# Design System: Pulpe (Strategic Visual Layer)

> **Doc graph — read these together**
>
> - **Strategic foundation:** [PRODUCT.md](./PRODUCT.md) — audience, voice, brand pillars, anti-references
> - **Visual common (this file):** the cross-platform DA — color seeds, typography lineage, voice rules, named rules that apply everywhere
> - **iOS extensions:** [ios/DESIGN.md](./ios/DESIGN.md) — tokens, components, Liquid Glass, sheets, SwiftUI patterns
> - **Web extensions:** [frontend/DESIGN.md](./frontend/DESIGN.md) — Material 3, Tailwind v4, responsive grid, Angular components
> - **Landing extensions:** [landing/DESIGN.md](./landing/DESIGN.md) — Poppins-only, hero compositions, marketing CTAs
>
> This file owns what is **shared**. Each platform doc owns its **specifics** and inherits everything below. When a rule applies everywhere, it lives here. When it depends on the rendering surface (SwiftUI vs Angular vs Next.js), it lives in the platform doc.

## 1. Overview: The Warm Naturalist

**Creative North Star: "Un grand bol d'air frais après avoir fermé Excel."**

Pulpe is calm naturalism for personal budgeting. The interface is the visceral shift from *subir* to *maîtriser* — fog lifts, cognitive load drops, the user breathes. Every surface is a warm neutral, every accent is a deliberate financial signal, every motion is a soft spring. Green is the brand color, not a celebration; red is reserved for one rare context where it earns its keep.

This system explicitly rejects: cold corporate banking apps with navy and aggressive charts; anxious finance apps that drench the UI in red; dense accounting software that intimidates with jargon-heavy chrome; Revolut's crunchy gradients on content cards; generic AI-tool sterile minimalism. Pulpe is warm. Pulpe is grounded. Pulpe is a companion, not a coach.

**Key Characteristics (cross-platform):**
- Warm neutral canvas (`#F7F6F3` family), never cold gray, never green-tinted
- Color carries meaning: green = savings/positive, amber = expense, blue = income, red = global deficit only
- Soft springs (response 0.4–0.6s, damping 0.65–0.85), zero bounce except on the landing page
- Manrope (display + amounts) + body font per platform (SF Pro on iOS, DM Sans on web, Poppins on landing). Two families per platform, max
- WCAG AA contrast, accessibility primary citizen on every surface
- Tutoiement always; microcopy disarms anxiety

## 2. Colors: The Warm Naturalist Palette

A neutral warm canvas with three semantic accents, one cautionary amber, and one rare red. No decorative color, anywhere. **Misusing color is lying.**

### Primary
- **Pulpe Forest** (`#006E25`, dark forest green): The brand color. Used for the primary CTA, the savings amount, the savings progress fill, brand glyphs. Carries `Soulagement`.

### Secondary
- **Sage** (`#406741`, muted secondary green): Discrete labels, secondary container fills. Never a CTA fill — it stays on the periphery.

### Tertiary
- **Lake** (`#0061A6`, calm corporate blue): Income amounts, info chips, links, edit actions. The "neutral information" hue. Never used for warnings.

### Financial Accents (semantic, not decorative)
- **Income / Lake** (`#0061A6`): All income surfaces.
- **Savings / Forest Bright** (`#157038`): All savings surfaces. A slightly brighter green than Pulpe Forest, tuned for ink contrast on warm surfaces.
- **Expense / Amber** (`#B35800`): All expense surfaces, moderate over-budget warnings. Warm amber, never red.
- **Over-Budget / Burnt Amber** (`#A86800`): Envelopes that have actually overrun. Still amber — the overshoot is *factual*, not punitive.
- **Hero Deficit / Sunset Coral** (`#C45028`, gradient mid-stop): The single legitimate red-adjacent surface. Reserved for the dashboard hero when total spending exceeds available (>100%). Never appears on a content row.

### Neutral
- **App Background** (`#F7F6F3`): The neutral warm canvas. Every screen sits on this. Dark mode is `#141210` — warm near-black, not pure `#000`.
- **Text Primary** (`#1A1C19`): Body text. Never pure `#000`.

### Destructive (Irreversible Only)
- **True Red** (`#C62828`): Account deletion, danger zone confirmations. **Never** used for over-budget feedback. Reserved for actions that cannot be undone.

> **Per-platform tuning:** the values above are the canonical seeds. Each platform may tune surface containers, dark-mode counterparts, or material-specific variants — see the per-platform DESIGN.md for resolved hex tables.

### Named Rules

**The Color Means Something Rule.** Every hue maps to a financial concept or a state. Green = positive / savings / actions. Blue = income / information / links. Amber = expense / moderate warning / over-budget. Red = hero deficit only. There is no decorative color in Pulpe. If a color doesn't map to a meaning, it doesn't ship.

**The Anxiety Red Rule.** Red is forbidden everywhere except the dashboard hero card when financial state is Deficit (>100% of available spent). Lines, rows, transactions, pills, and labels for expenses use **amber**, never red. *Le rouge n'est pas punitif* — quoting our own design doctrine.

**The Two-Zone Rule (cross-platform conceptual).** Every screen with a hero is split. The **emotion zone** at the top carries feeling — color-keyed to financial state. The **content zone** below is neutral warm and ruthlessly readable. Implementation differs per platform (gradient stops, fixed heights, transition values) but the conceptual split is universal. See platform docs for hex stops and pixel values.

## 3. Typography

**Display (every platform):** Manrope, bold and extrabold weights only. Carries the brand. Used for hero amounts, brand titles, headline numbers, and the Kind Tag inline label.

**Body / UI:** platform-specific.
- **iOS:** SF Pro (system) — Dynamic Type respected.
- **Web (Angular):** DM Sans — `--plain-family`.
- **Landing (Next.js):** Poppins (only Poppins, no display/body split — landing is poster-flat).

**Numbers:** tabular figures everywhere amounts appear. `monospacedDigit()` on iOS, `font-feature-settings: "tnum"` (or `tabular-nums`) on web.

**Character.** Manrope is friendly-modern with a bit of warmth in its terminals — it carries the brand without being decorative. The platform body font carries clarity and accessibility. Two families per platform, never three. No serifs. No geometric tech fonts (Inter, Roboto, Geist). No mono fonts in chrome (mono is reserved for recovery keys and codes).

> **Per-platform scale:** the size scale, line heights, and tracking values live in the platform-specific docs (`ios/DESIGN.md`, `frontend/DESIGN.md`, `landing/DESIGN.md`). The font *family* commitments above are universal.

### Named Rules

**The Tutoiement Rule.** Always "tu", never "vous". This is brand voice, not preference. Errors explain what happened and suggest a next step — never blame the user. Empty states guide. Microcopy disarms anxiety: *"Ça arrive"*, *"Tu le sais, et c'est déjà ça."*

**The Tabular Digits Rule.** Every numeric amount uses tabular figures. Digits don't wobble between updates. Non-negotiable on hero amounts, row amounts, pill counts.

**The Two-Family Rule.** Two font families per platform, max. Display + body. No third family. No mono in chrome. The landing page uses one family (Poppins) — single-family is allowed when the surface is simple enough.

## 4. Elevation

**Pulpe is flat by default with restrained tonal layering.** Shadows exist but they are diffuse and warm-tinted; they never define structure, only state. Depth comes from surface tone (warm hierarchy: app-background → surface containers → card surface), not from cast shadows. The hero card is gradient-filled; everything else is flat surface or hairline-bordered.

> **Per-platform shadow vocabulary** lives in the platform-specific docs. The principle (warm-tinted, state-only, never decorative) is universal.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. Tonal layering carries the hierarchy. Shadows appear only as a response to state (elevation, focus) or to lift the hero card. A flat list row is the default; a shadowed row is a deliberate signal.

## 5. Components

> **Every component lives in its platform doc.** This file does not declare button shapes, chip vocabularies, sheet patterns, or input styles — those depend on the rendering stack. Read:
>
> - **iOS components:** [ios/DESIGN.md](./ios/DESIGN.md) §5
> - **Web components:** [frontend/DESIGN.md](./frontend/DESIGN.md) §5
> - **Landing components:** [landing/DESIGN.md](./landing/DESIGN.md) §5

What's universal is the **vocabulary**: every platform has a Primary Button, Secondary Button, Destructive Button, Filter Pill, Stat Pill, Kind Tag, Form Input, Hero Card, Per-Row Card, and Sheet Form Container. The *names* travel; the *implementations* are platform-specific.

### Named Rules

**The Single Vocabulary Rule.** A component referred to by the same name across platforms must do the same job. A "Filter Pill" is a Filter Pill on iOS, web, and landing. If a platform invents a new affordance, it adds a new name, never reuses an existing one with different semantics.

**The Chip Composition Rule (cross-platform).** Chips and pills are **never** composed ad-hoc from raw shape primitives + padding + text in feature code. Each platform has a chip atom (`PulpeChip` on iOS, equivalent shared component on web/landing). Feature code consumes the atom, never reinvents the capsule.

## 6. Do's and Don'ts

### Do:
- **Do** map every color to a financial concept or state — savings green, income blue, expense amber, deficit red.
- **Do** address every user with "tu", everywhere, on every platform.
- **Do** use Manrope for display and amounts on every platform; pair with the platform body font (SF Pro / DM Sans / Poppins).
- **Do** keep the emotion zone at the top (gradient, financial-state-keyed) and the content zone below (neutral warm) wherever a screen has a hero.
- **Do** use tabular digits (`monospacedDigit()` / `tabular-nums`) on every numeric amount.
- **Do** route every chip / pill through the platform's chip atom — never reinvent the capsule + padding + count badge in feature code.
- **Do** consult [PRODUCT.md](./PRODUCT.md) before adding a new pattern — the strategic intent is upstream of every visual decision.

### Don't:
- **Don't** use Revolut's crunchy gradients on content cards. Gradients live in the hero zone and nowhere else.
- **Don't** ship cold banking apps with navy + aggressive charts — that's the explicit anti-reference.
- **Don't** use anxiety red anywhere except the dashboard hero deficit (>100% spent). Lines, rows, transactions, pills, kind tags for expenses use **amber**, never red.
- **Don't** use dense accounting jargon-heavy chrome — Pulpe is for tired humans, not finance nerds.
- **Don't** use display fonts (Manrope, Poppins) in UI labels, captions, or buttons on platforms with a body/display split — body fonts only for chrome.
- **Don't** use raw `#000` or `#FFFFFF` in any chrome — every neutral is tinted toward the warm canvas.
- **Don't** ship side-stripe borders (a >1px colored accent on the left or right edge of a card). Pulpe uses **full borders** + tints, never decorative side stripes.
- **Don't** mix three font families on any single platform. Two max — display + body. Landing uses one (Poppins).
- **Don't** invent a new chip name for an existing affordance, and don't reuse an existing chip name for a new affordance.
- **Don't** edit this file when the rule is platform-specific — push it down to `ios/DESIGN.md`, `frontend/DESIGN.md`, or `landing/DESIGN.md` instead. This file is for what is **shared**.
