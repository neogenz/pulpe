# Forms

## Layout

- **Single-column layout.** No multi-column forms — they cause zig-zag eye movement and missed fields.
- Stack **checkboxes and radio buttons vertically**, not horizontally.
- Exception: short related fields (expiry + CVC) can sit side-by-side within the single column.
- If a form is too long, **break into steps** — don't use multi-column.

## Labels

- **Stack labels on top of inputs**, not to the left.
- Never right-align labels beside inputs — creates a jagged left edge.
- Place labels **closely** above inputs (4pt gap label→field, 32pt gap between field groups).
- Never use placeholder text as a label replacement — it disappears on input and fails contrast.

## Field Count

- Minimise fields. Only ask for what's essential. Every field adds friction.

## Required & Optional

- Mark optional fields with **(optional)** in the label.
- Mark required fields with **\*** or **(required)** for maximum clarity.
- Don't colour the asterisk red (red = error).
- Replace optional fields with **opt-in checkboxes** where possible (progressive disclosure).
- Exception: skip markers on short, obvious forms (login, single-field subscribe).

## Field Width

- **Match width to expected input length.** Don't make all fields the same width.
- Wide fields for small inputs (postcode, CVC) set wrong expectations.

## Field Styles

- Use **conventional styles**: bordered rectangles for text, circles for radio, squares for checkboxes.
- If modifying, retain iconic elements (e.g. radio circle on the left).
- Underline-only fields look pre-filled and confuse users.

## Hints & Helper Text

- Display hints **above** the field (between label and input), not below.
- Hints below get covered by autofill menus and on-screen keyboards.
- Critical hints must be always visible — don't hide in tooltips.
- Avoid instructional verbs in labels: use "Email" not "Enter your email".

## Placeholder Text

- Avoid in most cases. Never as a label replacement.
- Exception: single search field if contrast >= 4.5:1 and accessible label exists.

## Dropdowns — Use Alternatives

| Scenario | Use instead |
|----------|-------------|
| **<= 10 options** | Radio buttons (1 click, always visible) |
| **Long lists** (countries) | Autocomplete search field |
| **Small numeric values** | Steppers (+/- buttons, >= 48pt, horizontal) |
| **Browsing long lists** | Split into multiple shorter dropdowns |

- Limit autocomplete suggestions to ~**10**.
- Highlight differences in suggestions with **bold**.

## Checkbox vs Toggle Switch

| Control | When |
|---------|------|
| **Checkbox** | Submit button required before effect. Label = what happens when checked. |
| **Toggle switch** | Immediate effect, no submit. Label = what happens when on. |

- Use **positive phrasing**: "Allow automatic updates" not "Don't allow automatic updates".

## Multi-Step Forms

- Tell users upfront: how long, what they'll need.
- Group related questions (6 steps of 5 > 30 steps of 1).
- Order: easiest → hardest (early wins).
- Show a **progress indicator**.
- Provide a **review step** before submission.
- Display a **success message** after submission.

## Grouping

- If not using steps, group related fields under **headings**.

## Field Border Contrast

- All interactive element borders: minimum **3:1** (inputs, buttons, toggles, steppers, checkboxes, radios).

## Validation

### On Submit

- Error summary at the **top** of the form, with links jumping to each invalid field.
- Error messages **above** invalid fields (not below).
- Red border + red background shade + error icon on invalid fields.
- Never rely on colour alone — always include an icon.
- Never disable the submit button.

### On Blur

- Validate after user leaves the field.
- Remove error once resolved (via real-time check).

### Real-Time

- Debounce — wait until user stops typing.
- Good for: password criteria, username availability.
- Risk: premature errors frustrate users.
