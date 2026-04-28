# Pulpe — Impeccable Design Context

## Design Context

### Users

Young, active people in Switzerland who want clarity and control over their personal budget. Not finance nerds — people who are tired of Excel, tired of guessing, and want to breathe. They use the app in quick daily glances and deeper monthly planning sessions. CHF currency, French-language UI. The product sells relief from a chronic pain, not another tool to learn.

### Brand Personality

**Warm, clear, grounded.**

Pulpe is "un grand bol d'air frais apres avoir ferme Excel." It's the UX equivalent of setting down your bags after a long trip — you breathe, you see clearly, you know where you're going. Never cold-corporate, never anxious-red, never dense-accounting.

Four emotional pillars drive every decision:
- **Soulagement** — the visceral shift from "subir" to "maitriser"
- **Clarte** — fog lifts, cognitive load drops, you see where you stand
- **Controle** — you're driving, not the app
- **Legerete** — calm technology, no judgment, no guilt

### Aesthetic Direction

**Calm naturalism with warm neutrals and purposeful color.**

- **Two-zone layout**: Emotion zone (top 30-35%, colored by financial state) transitions via soft gradient into content zone (neutral warm `#F7F6F3`). Character lives in the header; clarity lives below.
- **Theme**: Both light and dark, already implemented. Light is the primary experience. Dark follows system conventions.
- **Color philosophy**: Green = actions, savings, positive states. Amber = expenses (category) and moderate warnings. Blue = income, links, information. Red reserved ONLY for global deficit on the hero card. Neutral warm backgrounds — never green surfaces, never cold grays.
- **Financial state colors on hero**: Comfortable (<80%) = green gradient, Tight (80-100%) = amber, Deficit (>100%) = red. Lines themselves use amber spectrum only, never red.
- **References**: Revolut (clean, modern, financial clarity), Viseca One (Swiss, polished)
- **Anti-references**: Cold banking apps (navy + aggressive charts), anxious finance apps (red everywhere), dense accounting software (intimidating, jargon-heavy)

### Typography

| Platform | Display/Titles | Body/UI | Amounts |
|----------|---------------|---------|---------|
| iOS | Manrope (Bold) | SF Pro (system) | SF Pro tabular |
| Web | Manrope (`brand-family`) | DM Sans (`plain-family`) | DM Sans tabular |
| Landing | Poppins | Poppins | Poppins |

Max 2 families per platform. No geometric/tech fonts (Inter, Roboto). No serifs. Friendly, modern, lisible.

### Color Seeds

| Role | Seed | Usage |
|------|------|-------|
| Primary | `#006E25` | Actions, savings, positive accents |
| Secondary | `#406741` | Secondary elements, discrete labels |
| Tertiary | `#0061A6` | Income, links, information |
| Error | `#BA1A1A` | Hero deficit only (>100%) |
| Expense | `#B35800` | Expense category, moderate warnings |
| Neutral warm bg | `#F7F6F3` | Content zone background |
| Text primary | `#1A1C19` | Body text (never pure black) |

### Iconography

Outlined style (not filled), 1.5-2px stroke, rounded corners. Phosphor Icons or Heroicons (outline). Simple, recognizable, never aggressive. Prefer checkmarks over crosses.

### Motion

Soft springs (response 0.4-0.6s, damping 0.65-0.85). Transitions 200-300ms. No bounce/elastic. No stressful or fast animations. Feedback is immediate but gentle.

### Tone of Voice

- Tutoiement always ("tu", never "vous")
- Short, direct sentences. Everyday vocabulary, zero financial jargon.
- Encouraging without being condescending. Human warmth, not corporate.
- Errors: explain what happened + suggest next step, never blame the user.
- Empty states: guide, don't just state emptiness.
- Microcopy disarms anxiety: "Ca arrive", "Tu le sais, et c'est deja ca."

### Design Principles

1. **Relief over features** — Every screen should reduce cognitive load, not add to it. If it doesn't bring relief or clarity, it doesn't ship.
2. **Emotion at the top, information below** — The hero zone carries feeling (financial state as color); the content zone carries facts (neutral, readable, scannable).
3. **Color means something** — No decorative color. Every hue maps to a financial concept (income=blue, expense=amber, savings=green) or a state (healthy, tight, deficit). Misusing color is lying.
4. **Calm over clever** — No gamification, no guilt, no anxiety. Rounded corners, soft transitions, warm neutrals. The app is a companion, not a coach.
5. **One primary action per screen** — Visual hierarchy is non-negotiable. One filled green CTA, secondary actions in outlined or text style. The user always knows what to do next.

### Accessibility

- WCAG AA minimum (contrast, focus, labels)
- `prefers-reduced-motion` respected — disable spring animations, use instant transitions
- Touch targets: 44pt minimum (Apple HIG)
- No color-only signaling — always pair with text, icon, or shape
- Dynamic Type support on iOS

### Platform-Specific Notes

**iOS**: Liquid Glass reserved for navigation and floating controls in authenticated app only. Never on content cards. Pre-auth flows (welcome, login, onboarding) can use glow/shadow for brand expressivity. `.presentationBackground(Color.sheetBackground)` on all sheets.

**Web (Angular)**: Three token layers — `--pulpe-*` (semantic), Tailwind utilities, `--mat-sys-*` (Material foundation, theme only). Material overrides via `mat.*-overrides()`, never `::ng-deep`. Neutral seed `#8A8A82` for warm surface generation.

**Landing**: Poppins only. White/very light background. Maximum breathing room. Emotional benefit copy. Flat soft illustrations, no 3D.
