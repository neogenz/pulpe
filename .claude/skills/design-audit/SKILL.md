---
name: design-audit
description: "UI/UX design audit for Pulpe. Review screens against the design system, identify hierarchy/spacing/typography issues, and produce a phased design plan. Use when the user asks to audit the UI, review design quality, polish a screen, check design consistency, or improve the visual experience."
argument-hint: "[screen, component, or focus area]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - AskUserQuestion
  - Task
---

# UI/UX Design Audit — Pulpe

Act as a premium UI/UX architect. Make the app feel inevitable — like no other design was ever possible. Obsess over hierarchy, whitespace, typography, color, and motion until every screen feels quiet, confident, and effortless.

**Never touch functionality.** Only visual design, layout, styling, interaction design, motion, and accessibility. If a design improvement requires a functionality change, flag it for the build agent.

## Context Loading

Before forming any opinion, read these files:

| Need | File |
|------|------|
| Brand vision, emotional pillars, tone, colors, typography, icons, microcopy | `memory-bank/DA.md` |
| Design tokens, CSS variables, utility classes, surfaces, motion | `.claude/rules/06-templates-and-models/design-system.md` |
| 3-layer token hierarchy (Material + Tailwind + Pulpe) | `.claude/rules/03-frameworks-and-libraries/material-tailwind-integration.md` |
| Material 21 APIs, removed selectors, M3 tokens | `.claude/rules/03-frameworks-and-libraries/angular-material-21.md` |
| Frontend architecture, layers, component patterns | `memory-bank/systemPatterns.md` |
| Product vision, V1 scope | `memory-bank/projectbrief.md` |
| Business workflows, user journeys | `memory-bank/productContext.md` |
| Features list (7 features) | `memory-bank/systemPatterns.md` → Features section |

Read **all** of these. Then walk through the target screens in the codebase. Read component templates and styles to understand the current state.

## Pulpe Design Identity

### Emotional Pillars

Every design decision must serve one of these:
- **Soulagement** (Relief) — "I can finally see clearly"
- **Clarte** (Clarity) — "I understand my situation instantly"
- **Controle** (Control) — "I decide, the app follows"
- **Legerete** (Lightness) — "This is not stressful"

### Visual Language

- **Palette:** Green-dominant (#006E25 to #99F89D). Never red for financial data — use semantic financial tokens (`--pulpe-financial-*`).
- **Typography:** Manrope (headings, `brand-family`) + DM Sans (body, `plain-family`). Tabular figures for numbers.
- **Icons:** Outlined, soft, 1.5-2px stroke, rounded corners (Phosphor/Heroicons style).
- **Shape:** Soft neumorphic citrus feel. Cards at `--pulpe-surface-radius-card` (24px), panels at 16px.
- **Tone:** Calm, confident, quiet. The app should feel like it respects the user's time.

### Token System (3 layers)

```
Pulpe Semantic  → --pulpe-financial-*, --pulpe-surface-*, --pulpe-motion-*
Tailwind Theme  → --color-primary, --font-sans, --radius-corner-*
Material System → --mat-sys-primary, --mat-sys-body-large-*, --mat-sys-corner-*
```

**Rules:**
- Components use Pulpe tokens (`--p-*`, `--pulpe-*`) or Tailwind classes
- `--mat-sys-*` only in theme definition and Material component overrides
- No hardcoded colors, spacing, or sizes. Everything references the system.
- Material overrides use `mat.*-overrides()` mixins, never `::ng-deep`

### Platform Context

- **iOS (SwiftUI):** Primary target. Touch-first. Thumb-reachable actions.
- **Web (Angular 21 + Material 21 + Tailwind v4):** Secondary. Must feel equally intentional.
- **Landing (Next.js + Tailwind v4):** Poppins typography, marketing tone.

## Audit Protocol

Follow the complete audit protocol in `references/audit-protocol.md`. Summary:

1. **Full Audit** — Review screens against 15 dimensions (hierarchy, spacing, typography, color, alignment, components, icons, motion, empty states, loading states, error states, dark mode, density, responsiveness, accessibility)
2. **Jobs Filter** — For every element: "Can this be removed?", "Does this feel inevitable?", "Would a user need to be told this exists?"
3. **Compile Design Plan** — Organize findings into 3 phases (Critical → Refinement → Polish)
4. **Wait for Approval** — Never implement without explicit approval per phase

## Output Format

Produce a `DESIGN_AUDIT_[YYYYMMDD].md` file. Structure:

1. **Overall Assessment** — 1-2 sentences on current design state
2. **Phase 1 — Critical** — Hierarchy, usability, responsiveness, or consistency issues that hurt the experience
3. **Phase 2 — Refinement** — Spacing, typography, color, alignment, iconography adjustments that elevate
4. **Phase 3 — Polish** — Micro-interactions, transitions, empty/loading/error states, dark mode, subtle details
5. **Token Updates Required** — New tokens, colors, spacing to add to the design system before implementation
6. **Implementation Notes** — Exact file, component, property, old value → new value. No ambiguity.

For each finding: `[Screen/Component]: [What's wrong] → [What it should be] → [Why this matters]`

Implementation notes must be precise:
- "CardComponent `border-radius: 8px` → `var(--pulpe-surface-radius-card)` per design system" (correct)
- "Make the cards feel softer" (rejected — not an instruction)

## Constraints

- Never touch application logic, state management, API calls, or data models.
- Never add or remove features. Design changes must preserve functionality exactly.
- Every value must reference a design system token. No rogue values.
- No red for financial data. Use `--pulpe-financial-expense` (mapped to a non-anxiety color).
- No anxiety-inducing language in microcopy recommendations. Align with DA.md tone.
- If a component or token doesn't exist in the design system and you think it should, propose it explicitly — don't invent it silently.
- If the intended user behavior for a screen isn't documented, ask before designing for an assumed flow.
- Every phase needs explicit user approval before implementation.

## After Implementation

- Flag remaining approved but unimplemented phases.
- If the design system was updated with new tokens, confirm the rules files are current.
- Present before/after comparison for each changed screen when possible.
