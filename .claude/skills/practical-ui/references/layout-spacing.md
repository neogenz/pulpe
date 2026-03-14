# Layout, Spacing & Alignment

## Grouping (Gestalt Principles)

4 methods to group related elements (combine for clarity):

1. **Containers** — borders, shadows, backgrounds. Strongest cue. Use for main structure (sidebars, headers) and smaller groups (cards, dialogs). Don't overuse — if proximity already works, skip the container.
2. **Proximity** — related items close together, unrelated items far apart. More subtle than containers, produces cleaner designs.
3. **Similarity** — related items share size, shape, colour. Highlight a specific item by making it slightly different. Ensure similar-looking elements function similarly (don't make static elements look like buttons).
4. **Continuity** — align items in a straight line. Break continuity to mark section boundaries.

## Visual Hierarchy

Make more important elements more prominent using:

| Dimension | More important | Less important |
|-----------|---------------|----------------|
| Size | Larger | Smaller |
| Colour | Brighter, richer, warmer | Muted, desaturated |
| Contrast | Higher contrast, bold | Lower contrast, regular |
| Spacing | More surrounding whitespace | Less whitespace |
| Position | Top or first in row | Bottom or later |
| Depth | Elevated (shadow, lighter bg) | Flat |

### Steps to Build Hierarchy

1. Group related info into sections. Order sections by importance (most important = top).
2. Within each section, order items by importance.
3. Style primary info: large, bold, "Text strong".
4. Style secondary info: smaller, regular weight, "Text weak".
5. CTA: filled brand-colour button, stickied to bottom on mobile.
6. Use the **Squint Test**: blur your design — you should still identify the most important element.

## Box Model

Every UI rectangle: **margin** (space to neighbours) → **border** (stroke) → **padding** (space to content).

Spacing starts small for innermost rectangles and increases outward.

## Spacing Scale

Based on **8pt increments** (4pt for fine detail):

| Token | Value | Typical use |
|-------|-------|-------------|
| XS | 8pt | Innermost content (card text gaps) |
| S | 16pt | Related items, mobile margins/gutters |
| M | 24pt | Card padding, section content |
| L | 32pt | Nav links, column gaps, desktop gutters |
| XL | 48pt | — |
| XXL | 80pt | Section vertical padding, desktop margins |

### Rules

- Space elements based on **how closely related they are**: close = small, unrelated = large.
- Never use the same spacing value everywhere.
- When in doubt, pick the **next size up** — generous whitespace > cramped.
- Whitespace is a design element, not leftover space.
- Design at **@1x using points**, not pixels.

## Grid System

- Align main layout to a **12-column grid**. Decrease columns for smaller screens (e.g. 4 on mobile).
- Columns are **flexible** (percentage-based), not fixed.
- Smaller elements inside containers use predefined spacing, not the grid.
- **Gutters** (column separators): L (32pt) desktop, S (16pt) mobile. Must be narrower than columns.
- **Margins** (screen edges): XXL (80pt) desktop, S (16pt) mobile.

## Alignment

- **Left-align text** — consistent left edge = readability anchor.
- Maintain a straight left edge when mixing text with icons.
- Centre alignment only for short blocks.
- Align different-sized horizontal text to the **baseline**, not vertical centre (e.g. "$10 /month").
- Avoid multiple alignment types within a component. Stick with one (left preferred).
- Centre-aligned cards → make button full-width.
- Minimise alignment types: most elements share a single alignment.

## Fitts's Law

- Keep related actions **close to the element they affect**.
- Touch targets: >= **48pt x 48pt**.
- Close button near the open button.
- Place primary CTA at the bottom of mobile screens (thumb reach).

## Photography

- **Rule of Thirds**: place subjects on intersection points of a 3x3 grid, not dead centre.
- Align horizons with horizontal grid lines.
- Asymmetry increases sense of motion in action shots.

## Responsive Design

- Design for long data and edge cases, not just short text.
- If truncating, crop in the **middle** (not end) so users see unique suffixes.
