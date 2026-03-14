---
name: practical-ui
description: "Actionable UI design rulebook distilled from Practical UI (Adham Dannaway, 2nd Ed) with concrete values (px, ratios, HSB). Covers visual hierarchy, colour palettes, typography scales, spacing systems, button hierarchy, form patterns, copywriting rules, dark mode, and accessibility. Use when building or reviewing any UI — buttons, forms, cards, modals, layouts, error messages, colours, fonts. Also used as a reference by the design-audit skill."
argument-hint: "[component, screen, or design area]"
allowed-tools:
  - Read
  - Glob
  - Grep
---

# Practical UI — Design Rulebook

Battle-tested UI design rules from *Practical UI* by Adham Dannaway (2nd Edition). Every rule is concrete, with specific values (px, ratios, HSB) and backed by before/after evidence. This is a practitioner's reference, not abstract theory.

## When This Skill Triggers

Read the relevant reference file(s) based on what you're doing:

| You're working on... | Read |
|---|---|
| Accessibility, contrast, interaction states, design system setup | `references/foundations.md` |
| Colour palette, brand colour, dark mode, system colours, transparency | `references/colour.md` |
| Font size, line height, type scale, text alignment, text on photos | `references/typography.md` |
| Page layout, grids, spacing, alignment, visual hierarchy, grouping | `references/layout-spacing.md` |
| Buttons, CTAs, disabled states, destructive actions, links | `references/buttons.md` |
| Form fields, labels, validation, dropdowns, toggles, multi-step | `references/forms.md` |
| Labels, error messages, link text, microcopy, sentence case | `references/copywriting.md` |

**Load 1-3 files** depending on scope. For a full-screen review, load foundations + the most relevant domain files.

## How to Apply

1. **Building new UI**: Read the relevant reference(s) before writing code. Apply rules as you build — don't bolt them on after.
2. **Reviewing existing UI**: Read the reference(s), then audit the code against the rules. Flag violations with the specific rule and the fix.
3. **Design decisions**: When choosing between approaches (dropdown vs radio, disabled vs hidden, etc.), check the reference — the book almost certainly has an opinion with reasoning.

## Ship Checklist

Verify before shipping any UI:

- [ ] Hierarchy passes the **Squint Test** — blur it, can you still find the primary action?
- [ ] Text contrast >= **4.5:1** (small) / **3:1** (large text, UI elements)
- [ ] Touch targets >= **48pt x 48pt**, spaced >= **8pt** apart
- [ ] Body text line height >= **1.5**, line length **40-80 chars**
- [ ] Spacing follows a **predefined scale** (8pt base)
- [ ] Only **1 primary button** per screen
- [ ] Colour is never the **sole indicator** of meaning (add icon, underline, shape)
- [ ] Labels **above** inputs, **single-column** form layout
- [ ] Button text = **verb + noun** ("Save post", not "Ok")
- [ ] No pure black (#000) on pure white (#FFF) — use dark grey
- [ ] No disabled buttons without visible explanation
