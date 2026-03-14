# Foundations & Accessibility

## Core Principles

1. **Every design detail needs a logical reason** that improves usability — not just aesthetics.
2. **Minimise interaction cost** — closer + larger targets = faster selection (Fitts's Law).
3. **Minimise cognitive load** — remove unnecessary styles, info, and decisions.
4. **Use common design patterns** people already know (Jakob's Law).
5. **Be consistent** — similar elements must look and work similarly.
6. **80/20 rule** — 80% of users use 20% of features. Optimise for the critical 20%.

## Accessibility (WCAG 2.1 AA minimum)

### Contrast Ratios

| Element | Min ratio |
|---------|-----------|
| Small text (<=18px) | 4.5:1 |
| Large text (>18px bold, >24px regular) | 3:1 |
| UI components (borders, icons, form fields) | 3:1 |

### APCA Thresholds (WCAG 3 draft — more accurate, especially on dark backgrounds)

| Threshold | Use case |
|-----------|----------|
| 90 | Preferred for body text (14px+) |
| 75 | Minimum for body text (18px+) |
| 60 | Other text (24px regular or 16px bold+) |
| 45 | Large text (36px regular or 24px bold+) and UI elements |
| 30 | Placeholder text, disabled button text |
| 15 | Non-text elements |

### Rules

- Never rely on colour alone to convey meaning. Always add a secondary cue (icon, underline, shape).
- Underline links so colour-blind users can distinguish them from plain text.
- Touch targets: minimum **48pt x 48pt**. Separate buttons by at least **8pt**.
- Icons must always be paired with text labels — icons alone are ambiguous.
- Ensure form field borders are visible (3:1 contrast).

## Interaction States

Design all 5 states for every interactive element:

1. **Default** — appearance when idle
2. **Hover** — visual feedback on cursor hover
3. **Press/Active** — triggered on click/tap
4. **Focus** — triggered by keyboard navigation
5. **Disabled** — appearance when unavailable (prefer removing or locking over disabling)

## Design System Essentials

### Spacing Scale (8pt base)

| Token | Value |
|-------|-------|
| XS | 8pt |
| S | 16pt |
| M | 24pt |
| L | 32pt |
| XL | 48pt |
| XXL | 80pt |

Use 4pt increments for more granular needs.

### Border Radius

| Size | Value |
|------|-------|
| Small | 8pt |
| Medium | 16pt |
| Large | 32pt |

### Shadows

| Level | Use |
|-------|-----|
| Raised | Small, sharp shadow — cards, slightly elevated elements |
| Overlay | Larger, softer shadow — dropdowns, modals, floating elements |

Light source from top. Use palette's "Text strong" colour for shadows, not pure black.

### Usage Guidelines

- Indicate interactive elements with the brand colour.
- Use sentence case everywhere.
- Left-align text and buttons.
- Avoid disabled buttons.
- Front-load text with important info first.
- Be concise — use plain, simple language.

## Progressive Disclosure

- Show only what's needed for the current task.
- Hide secondary info behind expandable sections.
- Use opt-in checkboxes to reveal conditional fields.
- Use descriptive labels for disclosure triggers.

## Mobile-First Design

- Design for the smallest screen first — it forces prioritisation.
- Move primary CTA to the bottom of the screen (thumb reach).
- Stretch CTA buttons full-width on mobile.
- Don't fill large screens just because there's room.
