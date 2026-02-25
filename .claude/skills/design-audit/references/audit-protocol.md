# Design Audit Protocol

Complete audit procedure. Follow every step in order.

## Step 1: Full Audit

Review every target screen against these 15 dimensions. Miss nothing.

### 1. Visual Hierarchy
- Does the eye land where it should? Is the most important element the most prominent?
- Can a user understand the screen in 2 seconds?
- Is there one clear primary action per screen?

### 2. Spacing & Rhythm
- Is whitespace consistent and intentional? Do elements breathe or are they cramped?
- Is vertical rhythm harmonious?
- Are Pulpe layout tokens used? (`--pulpe-page-gutter-mobile` 16px, `--pulpe-section-gap-sm` 16px, etc.)

### 3. Typography
- Are type sizes establishing clear hierarchy?
- Are there too many font weights or sizes competing?
- Does the type feel calm or chaotic?
- Manrope for headings, DM Sans for body? Tabular figures for financial numbers?

### 4. Color
- Is color used with restraint and purpose? Does it guide attention or scatter it?
- Is contrast sufficient for accessibility (WCAG AA minimum)?
- Are financial semantics correct? (`--pulpe-financial-income`, `--pulpe-financial-expense`, `--pulpe-financial-saving`)
- No hardcoded hex values — everything through tokens?

### 5. Alignment & Grid
- Do elements sit on a consistent grid?
- Is anything off by 1-2 pixels? Every element must feel locked into the layout.

### 6. Components
- Are similar elements styled identically across screens?
- Are interactive elements obviously interactive?
- Are disabled, hover, focus, and active states all accounted for?
- Material 21 components used correctly? (`matButton="filled"`, not `mat-raised-button`)

### 7. Iconography
- Are icons consistent in style, weight, and size?
- From one cohesive set (Phosphor/Heroicons style: outlined, 1.5-2px stroke, rounded)?
- Do they support meaning or just decorate?

### 8. Motion & Transitions
- Do transitions feel natural and purposeful?
- Is there motion that exists for no reason?
- Using Pulpe motion tokens? (`--pulpe-motion-fast` 150ms, `--pulpe-motion-base` 220ms, `--pulpe-ease-standard`)
- Material 21 uses CSS-based animations internally — no animation imports needed.

### 9. Empty States
- What does every screen look like with no data?
- Do blank screens feel intentional or broken?
- Is the user guided toward their first action?
- Using `pulpe-state-card` with `variant='empty'`?

### 10. Loading States
- Are skeleton screens, spinners, or placeholders consistent?
- Does the app feel alive while waiting or frozen?
- Using `pulpe-state-card` with `variant='loading'`?

### 11. Error States
- Are error messages styled consistently?
- Do they feel helpful and clear or hostile and technical?
- Using `pulpe-state-card` with `variant='error'`?
- Microcopy aligned with DA.md: explain + suggest, never blame.

### 12. Dark Mode
- If the `.dark-theme` class is active, do all tokens, shadows, and contrast ratios hold up?
- Is it actually designed or just inverted?
- Tailwind `dark:` variant scoped to `.dark-theme` class.

### 13. Density
- Can anything be removed without losing meaning?
- Are there redundant elements saying the same thing twice?
- Is every element earning its place on screen?
- Material density classes available: `.density-1` through `.density-5`.

### 14. Responsiveness
- Does the screen work at mobile (375px), tablet (768px), and desktop (1024px+)?
- Are touch targets sized for thumbs on mobile? (minimum 44x44px)
- Does the layout adapt fluidly — not just snap at breakpoints?
- Using responsive gutters? (`--pulpe-page-gutter-mobile` 16px, tablet 24px, desktop 32px)

### 15. Accessibility
- Keyboard navigation works?
- Focus states visible and styled?
- ARIA labels on interactive elements?
- Color contrast ratios meet WCAG AA (4.5:1 text, 3:1 large text)?
- Screen reader flow is logical?

## Step 2: Jobs Filter

For every element on every screen, ask:

1. **"Would a user need to be told this exists?"** — If yes, redesign until obvious.
2. **"Can this be removed without losing meaning?"** — If yes, remove it.
3. **"Does this feel inevitable, like no other design was possible?"** — If no, it's not done.
4. **"Is this detail as refined as the details users will never see?"** — The back of the fence must be painted too.
5. **"Say no to 1,000 things"** — Cut good ideas to keep great ones.

## Step 3: Compile the Design Plan

Organize findings into the output format described in SKILL.md. Structure:

### Phase 1 — Critical
Visual hierarchy, usability, responsiveness, or consistency issues that actively hurt the experience.

For each finding:
```
[Screen/Component]: [What's wrong] → [What it should be] → [Why this matters]
```

Review: Why these are highest priority.

### Phase 2 — Refinement
Spacing, typography, color, alignment, iconography adjustments that elevate the experience.

Review: Reasoning for Phase 2 sequencing.

### Phase 3 — Polish
Micro-interactions, transitions, empty states, loading states, error states, dark mode, and subtle details that make it feel premium.

Review: Reasoning and expected cumulative impact.

### Token Updates Required
Any new tokens, colors, spacing values, typography changes, or component additions needed in:
- `.claude/rules/06-templates-and-models/design-system.md`
- `styles/vendors/_tailwind.css`
- Global SCSS files

These must be approved and added before implementation begins.

### Implementation Notes
Exact file, exact component, exact property, exact old value → exact new value.

Rules:
- Written so the build agent can execute without design interpretation
- No ambiguity
- Reference token variables, not raw values
- Reference Material override mixins when changing Material component styles
- Specify which architecture layer the change belongs to (ui, pattern, feature, styles)

## Step 4: Wait for Approval

- Do not implement anything until the user reviews and approves each phase
- The user may reorder, cut, or modify any recommendation
- Once a phase is approved, execute surgically — change only what was approved
- After each phase, present the result for review before moving to the next
- If the result doesn't feel right after implementation, propose a refinement pass

## Design Rules Quick Reference

1. **Simplicity is architecture** — If the user needs to think about how to use it, the design failed
2. **Consistency is non-negotiable** — Same component, same style, everywhere. No third variations.
3. **Hierarchy drives everything** — One primary action per screen, unmissable
4. **Alignment is precision** — Every element on the grid, no exceptions
5. **Whitespace is a feature** — Crowded = cheap. Breathing room = premium.
6. **Design the feeling** — Calm, confident, quiet. Aligned with Pulpe's emotional pillars.
7. **Mobile first** — iOS is the primary target. Design for thumbs, then cursors.
8. **No cosmetic fixes without structural thinking** — Every change needs a design reason
