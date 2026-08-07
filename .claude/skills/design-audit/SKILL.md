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
| Product strategy | `PRODUCT.md` |
| Visual foundation | `DESIGN.md` → target platform `DESIGN.md` |
| User needs and workflows | `docs/BUSINESS_WORKFLOW.md` |
| Cross-feature business behavior | `docs/BUSINESS_RULES.md` |
| Design tokens, CSS variables, utility classes, surfaces, motion | `.claude/rules/06-templates-and-models/design-system.md` |
| 3-layer token hierarchy (Material + Tailwind + Pulpe) | `.claude/rules/03-frameworks-and-libraries/material-tailwind-integration.md` |
| Material 22 APIs, removed selectors, M3 tokens | `.claude/rules/03-frameworks-and-libraries/angular-material-22.md` |
| Macro architecture | `aidd_docs/memory/architecture.md` |

Always read the product and visual hierarchy. Load only the workflow, business, architecture, rule, and Practical UI references relevant to the target:

| Audit dimension | Practical UI reference |
|---|---|
| Hierarchy, spacing, alignment | `.claude/skills/practical-ui/references/layout-spacing.md` |
| Typography, font sizes, line height | `.claude/skills/practical-ui/references/typography.md` |
| Colour, contrast, dark mode | `.claude/skills/practical-ui/references/colour.md` |
| Buttons, CTAs, destructive actions | `.claude/skills/practical-ui/references/buttons.md` |
| Forms, labels, validation | `.claude/skills/practical-ui/references/forms.md` |
| Microcopy, error messages, labels | `.claude/skills/practical-ui/references/copywriting.md` |
| Accessibility, interaction states | `.claude/skills/practical-ui/references/foundations.md` |

Then walk through the target screens in the codebase. Read component templates and styles to understand the current state.

## Canonical Design Contract

The `PRODUCT.md` → `DESIGN.md` → platform `DESIGN.md` hierarchy is authoritative. Do not restate or override its visual, emotional, platform, or microcopy decisions in an audit; cite the relevant section and use `.claude/rules/` only for implementation mechanics.

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
- Apply the semantic color and microcopy rules from the canonical DESIGN documents.
- If a component or token doesn't exist in the design system and you think it should, propose it explicitly — don't invent it silently.
- If the intended user behavior for a screen isn't documented, ask before designing for an assumed flow.
- Every phase needs explicit user approval before implementation.

## After Implementation

- Flag remaining approved but unimplemented phases.
- If the design system was updated with new tokens, confirm the rules files are current.
- Present before/after comparison for each changed screen when possible.
