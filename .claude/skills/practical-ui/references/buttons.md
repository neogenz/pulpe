# Buttons & Interactive Elements

## 3 Button Weights

| Weight | Style | When to use |
|--------|-------|-------------|
| **Primary** | Solid fill, brand colour, white text, rounded corners | The single most important action on screen |
| **Secondary** | Border only, brand-coloured border + text, rounded corners | Less important or equally important actions |
| **Tertiary** | No background, underlined brand-coloured text (link-style) | Least important actions, destructive actions |

### Rules

- **Only 1 primary button per screen.** If no single most important action, use all secondary.
- Don't give primary and secondary the same solid-fill style — hierarchy is destroyed.
- Don't use light grey fills for secondary — looks disabled.
- Keep button shapes consistent (don't mix pill and rectangle).
- Primary/secondary must have clearly different visual weight.

## Button Accessibility

- Button text contrast: >= **4.5:1** (WCAG 2.1 AA).
- Button border/shape contrast: >= **3:1** against background.
- If buttons have identical styles, contrast between them must be >= **3:1**.
- Don't rely on colour alone to differentiate levels — use shape/style differences.
- Minimum touch target: **48pt x 48pt**.
- Minimum space between buttons: **16pt** (at least 8pt).

## Button Text

- Write as **verb + noun**: "Save post", "Discard message", "Start workout".
- Must make sense read out of context (screen readers jump to buttons directly).
- Never use vague labels: "Ok", "Submit", "Yes", "Click here".

## Button Alignment

- **Left-align buttons**, ordered left to right: most important → least important.
- On mobile: **stack vertically**, top to bottom, most → least. Full-width buttons.
- Multi-step forms: "Next" left-aligned at bottom. "Back" as tertiary at top-left (not beside Next).
- Exception: single-field forms (search, subscribe) — button right of field is fine.

## Button Size

- Minimum **48pt x 48pt**. Make frequently used buttons larger.
- Extend tap target area beyond visual bounds when needed (invisible padding).
- Visually indicate the tappable region (hover/active background).

## Icon + Text Pairing

- Match icon **weight/thickness** to text weight.
- Match icon **size** to text size.
- If can't match, decrease icon contrast/opacity to balance.

## Disabled Buttons — Avoid Them

- Disabled buttons give no feedback on **why** an action is unavailable.
- Low contrast = invisible to low-vision users.
- Not keyboard accessible.
- **Alternative**: keep button enabled, validate on submit, show inline error messages.

### When Action Is Unavailable

Options (in order of preference):

1. **Remove the button entirely** + explain why it's unavailable and what to do.
2. **Keep visible with lock icon** — maintains discoverability and contrast. Explain how to unlock.
3. **Disable with visible explanation** — if you must disable, show a message near the button explaining why + how to enable.

## Destructive Actions — Scale Friction with Severity

| Level | Technique |
|-------|-----------|
| Initial | Make less prominent (tertiary style), move further away |
| Light | Confirmation dialog before executing |
| Moderate | Red-highlighted confirmation message + red confirm button |
| Heavy | Red styling + mandatory checkbox ("I confirm...") before button activates |

- Don't colour the initial trigger button red — it makes it more prominent and attractive.
- Always consider providing **undo** instead of confirmation (e.g. toast with "Restore" link).

## Links

- Inline text links: coloured **and** underlined (accessibility).
- Nav menus, cards, tabs: underline not needed (context provides cues).
- If a coloured+underlined link is too prominent, keep underline but remove colour.
