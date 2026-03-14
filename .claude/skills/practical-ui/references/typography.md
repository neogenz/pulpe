# Typography

## Typeface Selection

- Use a **single sans serif** for most interface designs — legible at all sizes, neutral, simple.
- Choose typefaces with: multiple weights, tall x-height, generous letter spacing, multi-language support.
- When in doubt, use the **platform system typeface**.
- To add personality: introduce a **second typeface for headings only**. Keep sans serif for body.
- Avoid decorative/serif typefaces for UI text.

### Mood Guide

| Style | Mood |
|-------|------|
| Sans serif | Neutral, modern |
| Serif | Traditional, classic |
| Rounded sans serif | Fun, soft, playful |
| Light sans serif | Chic, luxurious |

## Font Weights

- Use only **regular** and **bold**. Optionally substitute semi-bold for bold.
- Bold for headings, regular for body and small text.
- Never use thin/light weights at small sizes — illegible.
- Very thin or thick weights only for large headings.

## Type Scale

Use a ratio-based scale. Start with a base (e.g. 16px), multiply by ratio, round to whole numbers.

### Common Ratios

| Name | Ratio | Best for |
|------|-------|----------|
| Minor Second | 1.067 | — |
| Major Second | 1.125 | Complex apps, dashboards |
| Minor Third | 1.200 | General purpose |
| Major Third | 1.250 | — |
| Perfect Fourth | 1.333 | — |
| Augmented Fourth | 1.414 | — |
| Perfect Fifth | 1.500 | Simple marketing sites |
| Golden Ratio | 1.618 | — |

### Example Scale (Minor Third 1.200)

| Style | Size | Line height |
|-------|------|-------------|
| H1 | 40px | 48px |
| H2 | 32px | 40px |
| H3 | 24px | 32px |
| H4 | 20px | 28px |
| Small/Body | 16px | 24px |
| Tiny | 14px | 20px |

**Ensure line heights are divisible by 4** to align to a 4pt vertical grid.

Use smaller scales for complex apps. Consider switching to a smaller scale on mobile.

## Body Text

- Long body text: minimum **18px**.
- 14px body text is too small for comfortable reading.

## Line Height

- Body text: minimum **1.5** (1.5–2.0 range).
- **Decrease line height as font size increases.** Body at 1.6, headings at ~1.3.
- Longer lines → taller line height.
- Heavier typefaces → taller line height.

## Line Length

- **40–80 characters per line** (including spaces).
- < 30 chars → too many breaks, eye strain.
- > 80 chars → hard to track line starts.
- Don't stretch text to full page width. Constrain the text column.

## Text Alignment

- **Left-align** for optimal readability (F-shaped reading pattern).
- Centre alignment only for short headings and brief text.
- Never centre-align long body text.
- Never justify long body text — creates uneven spacing and "rivers".
- Don't mix alignments in the same section.

## Letter Spacing

- **Decrease letter spacing for large headings** — default spacing looks too wide at display sizes.
- "Text type" faces (designed for body) need more tightening at large sizes.
- "Display type" faces are already optimised.

## Text on Photos

Minimum contrast: 4.5:1 (small text), 3:1 (large text). Techniques:

1. **Linear gradient overlay** — dark grey at 90% opacity bottom, fading to 0% halfway up + text shadow
2. **Semi-transparent overlay** — dark grey at 50% over entire photo + text shadow
3. **Blurred overlay** — behind text area only
4. **Solid background** — dark grey rect behind text

## Text Colour

- Never use very light grey text (fails 4.5:1).
- Never use pure black (#000) on white (#FFF) — eye strain. Use dark grey.

## Uppercase

- Avoid uppercase text — it's loud, hard to read, destroys word shape.
- Exception: short labels in **bold, ~14px, +2px letter spacing** to differentiate from other text.
