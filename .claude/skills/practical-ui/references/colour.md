# Colour System

## Design in Black & White First

Design interfaces in greyscale before adding colour. This forces focus on spacing, size, layout, and contrast.

- White-dominant (#FFF + #1A1A1A) = simple, classic, minimal
- Dark-dominant (#1A1A1A + #FFF) = dramatic, powerful, luxurious
- **Avoid pure black (#000) on pure white (#FFF)** — the extreme contrast causes eye strain. Use dark grey instead.

## Brand Colour

- Use **1 brand colour** alongside black and white.
- Apply brand colour **only to interactive elements** (buttons, links, active tabs) — never to headings or non-interactive elements.
- Brand colour must have >= **4.5:1 contrast** against the background.
- **Avoid red as a brand colour** — conflicts with error system colour.
- If brand has multiple colours, use the highest-contrast one for interactive elements; others for decoration only.

### Low-Contrast Brand Colours (e.g. yellow)

- Darken the brand colour for text links/buttons.
- Use brand colour as text on buttons (not background).
- Add borders to buttons (>= 3:1 contrast).
- On dark backgrounds: lighten and desaturate the brand colour.

## 7-Colour Palette Structure

| Role | Usage | Contrast requirement |
|------|-------|---------------------|
| **Brand** | Interactive elements (buttons, links) | >= 4.5:1 vs fill |
| **Text strong** | Primary text (headings, body, labels) | >= 4.5:1 vs fill |
| **Text weak** | Secondary/supporting text | >= 4.5:1 vs fill |
| **Stroke strong** | UI element borders (inputs, icons) | >= 3:1 vs fill |
| **Stroke weak** | Decorative borders (dividers) | No strict requirement |
| **Fill** | Secondary backgrounds (tags, badges) | Elements on it must meet contrast |
| **Background** | Main page background | Elements on it must meet contrast |

### HSB System

Use HSB (Hue, Saturation, Brightness) — more intuitive than hex/RGB. Keep hue constant across variations; change only saturation and brightness.

### Light Palette Example (Hue 230)

| Role | HSB |
|------|-----|
| Brand | (230, 65, 85) |
| Text strong | (230, 57, 24) |
| Text weak | (230, 27, 48) |
| Stroke strong | (230, 23, 65) |
| Stroke weak | (230, 5, 94) |
| Fill | (230, 2, 98) |
| Background | (0, 0, 100) |

### Dark Palette Example (Hue 230)

| Role | HSB |
|------|-----|
| Brand | (230, 40, 99) |
| Text strong | (230, 0, 100) — white |
| Text weak | (230, 5, 85) |
| Stroke strong | (230, 10, 65) |
| Stroke weak | (230, 15, 25) |
| Fill | (230, 20, 15) |
| Background | (230, 30, 10) |

### Monochromatic Greys

Prefer monochromatic greys (carrying the brand hue) over neutral greys. Creates a cohesive, branded look with fewer colours.

## System Colours

3 system colours, always paired with icons:

| Colour | Meaning | Light HSB | Dark HSB |
|--------|---------|-----------|----------|
| Red | Error/failure | (0, 71, 78) | (0, 39, 100) |
| Amber | Warning/caution | (42, 82, 56) | (42, 50, 88) |
| Green | Success/completion | (162, 95, 48) | (162, 40, 78) |

Each needs 4 opacity variations: 100% Text, 80% Stroke strong, 20% Stroke weak, 5% Fill.

## Transparent Colours

Use HSBA for elements on varied backgrounds. Transparent colours adapt automatically.

### Light Mode Foreground (black variations)

| Role | Opacity |
|------|---------|
| Text strong | 90% |
| Text weak | 60% |
| Stroke strong | 45% |
| Stroke weak | 10% |
| Fill | 4% |

### Dark Mode Foreground (white variations)

| Role | Opacity |
|------|---------|
| Text strong | 100% |
| Text weak | 78% |
| Stroke strong | 60% |
| Stroke weak | 12% |
| Fill | 6% |

Test contrast against the **overlay** background (brightest = lowest contrast).

## Interaction States via Colour

| State | Technique |
|-------|-----------|
| Hover | Fill colour overlay OR 80% opacity |
| Press | Stroke weak colour overlay |
| Disabled | 20% opacity (use sparingly — prefer removing) |
| Focus | Outline ring |

## Dark Mode Depth

Shadows don't work well in dark mode. Use colour brightness instead:

| Level | HSB |
|-------|-----|
| Base | (230, 30, 10) — darkest |
| Raised | (230, 25, 15) |
| Overlay | (230, 20, 20) — brightest |

## Colour Naming

### Primitives: `[colour.mode.number]`

Number from 0–1000 (1000 = highest contrast). E.g.: `grey.light.1000`, `green.dark.50`.

### Semantic: `[element.tone.emphasis.state]`

- Element: Text, Stroke, Icon, Fill, Background
- Tone: Neutral, Brand, Error, Warning, Success
- Emphasis: Strong, Weak
- State: Hover, Press, Focus, Disabled

E.g.: `text.error`, `stroke.strong`, `fill.success.weak`, `fill.hover`.

**Always use semantic colours in designs, never primitives directly.**

## Photo Temperature

Match photo colour temperature to your palette. Cool palette = cool photos. Warm = warm.
