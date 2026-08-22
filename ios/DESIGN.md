---
name: Pulpe iOS
description: SwiftUI native — calm naturalism for personal budgeting on iPhone. Inherits cross-platform DA from ../DESIGN.md.
colors:
  pulpe-primary: "#006E25"
  pulpe-primary-on: "#FFFFFF"
  pulpe-secondary: "#406741"
  pulpe-tertiary: "#0061A6"
  financial-income: "#0061A6"
  financial-expense: "#B35800"
  financial-savings: "#157038"
  financial-over-budget: "#905800"
  app-background: "#EFF3EE"
  sheet-background: "#F5F3F0"
  surface: "#FFFFFF"
  surface-container-low: "#FCFAF7"
  surface-container: "#F5F3F0"
  surface-container-high: "#F0EDE9"
  surface-container-highest: "#E8E5E1"
  text-primary: "#1A1C19"
  text-secondary: "#524D48"
  text-tertiary: "#6E6762"
  outline: "#6F7A6D"
  outline-variant: "#BFCABA"
  hero-comfortable: "#14AD45"
  hero-tight: "#D88010"
  hero-deficit: "#C45028"
  home-background: "#EFF3EE" # alias of app-background — the shared canvas
  home-hero-surface: "#CFE8D6"
  home-hero-ink: "#0E3A1C"
  home-hero-support: "#2C5136"
  home-hero-overlay: "#F3F9F5"
  drift-accent: "#C45028"
  destructive: "#C62828"
typography:
  display:
    fontFamily: "Manrope, -apple-system, sans-serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-3px"
  headline:
    fontFamily: "Manrope, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.6px"
  amount-hero:
    fontFamily: "Manrope, -apple-system, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-1.2px"
  amount-card:
    fontFamily: "Manrope, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.1
  title:
    fontFamily: "-apple-system, SF Pro, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "-apple-system, SF Pro, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
  list-row-title:
    fontFamily: "-apple-system, SF Pro, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
  metric-label:
    fontFamily: "-apple-system, SF Pro, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
  kind-tag:
    fontFamily: "Manrope, -apple-system, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.7px"
  label-medium:
    fontFamily: "-apple-system, SF Pro, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
  button:
    fontFamily: "-apple-system, SF Pro, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
rounded:
  hairline: "1px"
  xs: "4px"
  sm: "8px"
  button: "14px"
  card: "18px"
  md: "24px"
  lg: "30px"
  xl: "32px"
  pill: "9999px"
spacing:
  none: "0px"
  xxs: "2px"
  xs: "4px"
  tight-gap: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
  xxxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.pulpe-primary}"
    textColor: "{colors.pulpe-primary-on}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "54px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "54px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.pulpe-primary-on}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "0 24px"
    height: "54px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    size: "44px"
  button-icon-circle:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.pill}"
    size: "44px"
  button-text-link:
    backgroundColor: "transparent"
    textColor: "{colors.pulpe-tertiary}"
    typography: "{typography.body}"
    padding: "8px 4px"
  segmented-picker-track:
    backgroundColor: "rgba(118,118,128,0.12)"
    rounded: "{rounded.pill}"
    padding: "2px"
  segmented-picker-thumb:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "12px"
  chip-filter-selected:
    backgroundColor: "{colors.text-primary}"
    textColor: "{colors.app-background}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
  chip-filter-unselected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    padding: "12px 16px"
  chip-stat-income:
    backgroundColor: "rgba(0,97,166,0.15)"
    textColor: "{colors.financial-income}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-stat-savings:
    backgroundColor: "rgba(21,112,56,0.15)"
    textColor: "{colors.financial-savings}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  chip-stat-expense:
    backgroundColor: "rgba(179,88,0,0.15)"
    textColor: "{colors.financial-expense}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  card-row:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "12px 12px 12px 4px"
  sheet-form-container:
    backgroundColor: "{colors.sheet-background}"
    rounded: "{rounded.lg}"
    padding: "16px 20px 20px"
  input-form:
    backgroundColor: "rgba(118,118,128,0.12)"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Pulpe iOS

> **Doc graph**
>
> - **Strategic foundation:** [../PRODUCT.md](../PRODUCT.md)
> - **Cross-platform visual common:** [../DESIGN.md](../DESIGN.md) — read first; this file inherits everything there
> - **This file:** iOS-native extensions — tokens, components, Liquid Glass, sheets, SwiftUI patterns
> - **Sibling platforms:** [../frontend/DESIGN.md](../frontend/DESIGN.md), [../landing/DESIGN.md](../landing/DESIGN.md)
> - **No sidecar:** `/impeccable live` (which consumes `.impeccable/design.json`) is browser-only and unsupported on SwiftUI. iOS visual canon lives in this file alone.
>
> Everything in this doc is iOS-only. Cross-platform rules live in `../DESIGN.md` and are not repeated here.

## 1. Overview: iOS Native, Two-Zone, Tokens-First

iOS is the dominant Pulpe surface. SwiftUI native, iOS 18 deployment target with iOS 26 features behind `#available`. Liquid Glass on navigation only. Every visual value flows through `DesignTokens` (`ios/Pulpe/Shared/Design/DesignTokens.swift`) or `Color+Pulpe` (`ios/Pulpe/Shared/Extensions/Color+Pulpe.swift`); the project rule forbids raw design values, while SwiftLint enforces selected architecture and timing constraints.

**Stack:** SwiftUI + Swift 6 strict concurrency + Xcode (XcodeGen-driven `.xcodeproj`). Tests in Swift Testing (`@Suite` / `@Test` / `#expect`). Lefthook + SwiftLint pre-commit gates.

**iOS-specific characteristics:**

- Deployment target iOS 18, iOS 26 features (Liquid Glass, `.contentTransition(.symbolEffect(.replace))`) gated with `#available`
- Apple HIG 44pt tap target — `frame(minHeight:)` on the **Button**, never on the label
- Two-zone layout implemented via `BudgetDetailHero` + neutral content zone with a `LinearGradient` 40–60pt transition stop
- Sheets always declare `.standardSheetPresentation()` to prevent iOS 26 glass bleed
- Compositions tokens layer (`DesignTokens.ChipMetrics`) sits between primitives and feature surfaces

## 2. Colors: Resolved iOS Hex

The seeds in `../DESIGN.md` are abstract. The values below are the **iOS canonical hex** used in `Color+Pulpe`. Light mode unless noted; dark mode uses dynamic counterparts.

### Brand

- **Pulpe Forest** (`#006E25`): `Color.pulpePrimary`. Primary CTA capsule, savings amount, savings progress fill, brand glyphs. Dark mode: `#7EDB83` (lime, AAA contrast on near-black).
- **Sage** (`#406741`): `Color.pulpeSecondary`. Discrete labels, secondary container fills.
- **Lake** (`#0061A6`): `Color.pulpeTertiary`. Income amounts, info chips, links, edit actions. Dark mode: `#5AA8E0`.

### Financial Accents

- **Income / Lake** (`#0061A6`): `Color.financialIncome`.
- **Savings / Forest Bright** (`#157038`): `Color.financialSavings`. Slightly brighter than `pulpePrimary`, tuned for ink contrast on warm surfaces.
- **Expense / Amber** (`#B35800`): `Color.financialExpense`.
- **Over-Budget / Burnt Amber** (`#905800` light, `#E5A33A` dark): `Color.financialOverBudget`.
- **Hero Deficit / Sunset Coral** (`#C45028`): `Color.heroTintDeficit`. Gradient mid-stop only (legacy, removed with the Budget Detail hero migration).

### Hero Zone (constant brand surface)

The hero surface is the brand forest, never tinted by financial state. Ratios measured by `HeroContrastTests` (WCAG 2.1, text 4.5:1, non-text 3:1):

| Token | Light | Dark | Ratio on `heroSurface` |
| --- | --- | --- | --- |
| `Color.heroSurface` | `#0E3A1C` | `#0B2E16` | 11.4:1 vs `appBackground` |
| `Color.heroSurfaceTop` | `#14512A` | `#0E3A1C` | top gradient stop |
| `Color.heroInk` | `#FFFFFF` | `#F3F9F5` | 12.8:1 |
| `Color.heroInkSecondary` | `#CFE8D6` | `#CFE8D6` | 9.9:1 |
| `Color.heroTile` | `heroInk` @ `Opacity.heroTile` (0.12) | same | surface, not a signal |
| `Color.heroAccentPositive` | `#7EDB83` | same | 7.5:1 |
| `Color.heroAccentCaution` | `#E5A33A` | same | 5.9:1 |
| `Color.heroAccentDeficit` | `#F08A6A` | same | 5.2:1 |
| `Color.heroAccentInfo` | `#5AA8E0` | same | 4.9:1 |

The previous state-tinted heroes (`#14AD45`, `#D88010` under white ink) measured 2.96:1 and 2.99:1 — refused.

### Surface (Warm Hierarchy)

- **App Background** (`#EFF3EE`): `Color.appBackground`. Dark mode: `#121611`. Warm sage canvas, shared app-wide. **iOS override** of the cross-platform neutral `#F7F6F3` (root `DESIGN.md`) — the home dashboard's calm tone is now the default on every iOS screen; webapp and landing keep the neutral.
- **Sheet Background** (`#F5F3F0`): `Color.sheetBackground`. Slightly cooler-warm than the app, providing contrast against cards.
- **Surface / Card** (`#FFFFFF` light, `#1A1816` dark): `Color.surface`.
- **Surface Containers** (`#FCFAF7` → `#E8E5E1`): tonal layering. Low for resting cards, highest for pressed chip backgrounds.

### Text

- **Text Primary** (`#1A1C19`): `Color.textPrimary`. Body text. Never pure `#000`.
- **Text Secondary** (`#524D48`): `Color.textSecondary`. WCAG AAA on warm surfaces.
- **Text Tertiary** (`#6E6762`): `Color.textTertiary`.

### Outline

- **Outline / Variant** (`#6F7A6D` / `#BFCABA`): `Color.outline` / `Color.outlineVariant`. Hairline borders, dividers.

### Destructive

- **True Red** (`#C62828`): `Color.destructivePrimary`. `DestructiveButtonStyle` only.

### iOS-Specific Named Rules

**The Two-Zone Rule (iOS implementation).** Every screen with a hero is split. The **emotion zone** is the constant brand forest (`Color.heroSurface`, two-stop gradient from `heroSurfaceTop`), full-bleed under the navigation bar (`.toolbarColorScheme(.dark, for: .navigationBar)`), painted by `View.heroZone()` as the hero's own scroll-native background (bled `Layout.overscrollBleed` above, so pull-to-refresh and the status bar stay forest). The **content zone** rises over it through `View.contentZone()`: an `appBackground` card with `CornerRadius.zone` upper corners and `Shadow.zoneBoundary`, overlapping the forest by that radius. The curve belongs to the card, never to the forest. The financial state is read in the verdict sentence, one chip and the chart accent (`heroAccentPositive` / `heroAccentCaution` / `heroAccentDeficit`), never in the surface color. Below is the **content zone** — `Color.appBackground` (the warm sage canvas), lists and cards on top. Screens without a dominant financial state (templates, the savings-goal list, settings) skip the emotion zone entirely. The month and the account live in the native navigation bar, not in a header rebuilt inside the scroll.

**The One Hero Rule.** Every surface with a dominant financial state (home, budget detail, yearly view, savings-goal detail) composes its hero from the shared `HeroZone` family (`heroZone()` / `contentZone()`, `HeroFigure`, `HeroMetricTile`, `HeroVerdictRow`). No screen draws its own hero grammar.

**The One Ledger Rule.** Every list is a grouped card (`pulpeCard()`), rows separated by hairlines, each row opened by a 36pt leading disc (`RowIcon` / `PointCircle`). `pulpeRowCard` never dresses a single row. Nature is carried by the disc and the amount color, not by an inline tag. The disc is also the pointing control: a ring in the tint means "to point", a filled disc with a checkmark means "pointed"; a leading swipe on the row is the second path to the same toggle, and an announced withdrawal keeps a plain disc.

**The Three Families Rule.** At most three chip families are visible on a screen. Any 1-of-N choice is a `SegmentedPicker`. `PulpeChip.muted` never sits on the bare canvas. Hero stat pills are `HeroMetricTile`s, not chips.

**The Home Ledger Rule.** Everything below the hero is a **titled block on a card**, never a run of rows on the bare page. A section names itself with `SectionHeader` — the section title, an optional amount under it, and, when there is somewhere to go, a **named** link (`Tout voir`, `Budget`) rather than a bare chevron. That header sits on the page background, outside the card, so the card boundary marks where the section's content starts. Under it, one card (`pulpeRowCard()` — the shared card fill plus the subtle lift) carries the rows. A row opens with a `RowIcon`: a 36pt disc tinted at `Opacity.accent` in the color of what the row is about, which is what makes the list scannable without reading it — but only when the card's rows are of different natures. A homogeneous list (every row a contribution, every row a withdrawal) already knows what it is from its section title, and the repeated glyph reads as texture rather than information; there the row opens on its name. A hairline may separate rows **inside** a card and nothing else — on the bare page a rule divides nothing and reads as unfinished. Activity groups its rows by day, the day named once above its card instead of repeated under every row. `SectionHeader` owns the screen's only Dynamic Type branch; the rows below it wrap rather than re-stack. The rule is not the home's alone: `SectionHeader` lives in `Shared/Components/` and the savings-goal detail names every one of its sections with it.

## 3. Typography: iOS Resolved Scale

Manrope for display + Pulpe amounts; SF Pro (system) for everything else. Dynamic Type respected on all body and label roles.

### Hierarchy (iOS values)

- **Display** (Manrope ExtraBold, 72pt, lh 1.0, tracking `-3px`): Year recap big number on the budget list.
- **Headline** (Manrope Bold, 34pt, lh 1.05, tracking `-0.6px`): Brand titles.
- **Dashboard Hero** (Manrope ExtraBold 48pt for the figure, Manrope Bold 24pt for the currency suffix, both scaling against `.largeTitle`): The estimated month-end balance on the home dashboard, split across two roles on one baseline so the figure dominates and the suffix stays secondary.
- **Amount Hero** (Manrope ExtraBold, 34pt, lh 1.0, tracking `-1.2px`): The hero balance amount on `BudgetDetailsView`. Black on neutral, never colored.
- **Amount Card** (Manrope ExtraBold, 20pt): Per-row card amounts. Tabular figures via `monospacedDigit()`.
- **Title** (SF Pro Semibold, 22pt): Section titles, sheet titles.
- **Body** (SF Pro, 17pt): Default content, descriptions.
- **List Row Title** (SF Pro Semibold, 17pt): Budget line names, transaction descriptions.
- **Metric Label** (SF Pro Bold, 13pt): Pill text, chip labels, count badges.
- **Kind Tag** (Manrope ExtraBold, 10pt, tracking `0.7px`, uppercased): Inline `REVENU` / `ÉPARGNE` / `DÉPENSE` tags above row labels.
- **Label Medium** (SF Pro Medium, 13pt): Form field labels, secondary metadata.
- **Button** (SF Pro Semibold, 17pt): All button text.

Live tokens: `ios/Pulpe/Shared/Styles/Typography.swift`.

### iOS-Specific Named Rules

**The Two-Decimals Rule (Budget Detail page).** On the iOS Budget Detail page, all currency amounts render with two decimals (`1'234.56 CHF`). `asCompactCurrency` (the rounded compact format) is **prohibited** in this context. Other surfaces apply the dual aggregation/ligne policy from the project's currency-formatting rule.

**The Hero Flat Rule.** The Budget Detail hero amount is `Manrope ExtraBold` rendered in `Color.textPrimary` (black on neutral). The hero is **flat** on the warm canvas — no surface, no border, no shadow. Color comes from the financial-state pill row beneath it, never from the hero number itself. The savings-goal detail hero obeys the same rule: the confirmed amount is `amountHero` in `Color.textPrimary`, and the only colour on it comes from the progress bar underneath.

## 4. Elevation

Pulpe iOS is **flat by default with restrained tonal layering**. Shadows are diffuse and warm-tinted; they never define structure, only state. Live tokens: `DesignTokens.Shadow`.

### Shadow Vocabulary

- **Subtle** (`0 1px 2px rgba(0,0,0,0.05)`): Per-row card lift on the Budget Detail page.
- **Card** (`0 2px 4px rgba(0,0,0,0.06)`): Default card lift.
- **Elevated** (`0 4px 8px rgba(0,0,0,0.08)`): Modals, dialog surfaces.
- **Zone Boundary** (`Shadow.zoneBoundary`): cast by the hero surface onto the content zone, light mode only.
- **Input** (`0 2px 6px rgba(0,0,0,0.04)`): Auth and currency input field rest state.
- **Toast** (`0 4px 8px rgba(0,0,0,0.10)`): Toast notifications.

### iOS-Specific Named Rules

**The Glass Restraint Rule.** iOS 26 Liquid Glass appears on **navigation only** — toolbars, tab bars, floating buttons, sheets with partial detents. _Never_ on content cards, list rows, or text. The system handles this for standard navigation components; custom views must `.glassEffect()` only on navigation chrome. Pre-auth flows (welcome, login, onboarding) may use glow / shadow for brand expressivity; the authenticated app stays restrained.

**The Hero Depth Rule.** The hero's depth is a two-stop gradient (`heroSurfaceTop` → `heroSurface`) plus `Shadow.zoneBoundary`. Nothing else: no inner glow, no glass, no border on tiles (a translucent tint, never a solid stroke). On the home screen only, the hero follows the scroll at `Motion.heroParallax` (`heroZone(parallax: true)`) so the card reads as covering it; every other hero scrolls 1:1, and Reduce Motion turns the parallax off everywhere.

**The Sheet Background Rule.** Every sheet must declare `.standardSheetPresentation()` (which bundles `.presentationBackground(Color.sheetBackground)` + detents + drag indicator + corner radius). iOS 26's Liquid Glass bleeds through any sheet without an explicit presentation background. **No exceptions.** Custom-background sheets (gradient sheets like RecoveryKey) declare `.presentationBackground { ... }` explicitly.

## 5. Components

Live in `ios/Pulpe/Shared/Components/` and `ios/Pulpe/Shared/Design/PrimaryButtonStyle.swift`.

### Buttons

- **Shape:** Capsule (`pill` rounded, `9999px`). The capsule is the brand button.
- **Primary (`PrimaryButtonStyle`):** flat `Color.pulpePrimary` fill for enabled, `primaryContainerDisabled` for disabled. `textOnPrimary` text. Full-width, 54pt height. One per screen; no gradient — the hero is the screen's only saturated element.
- **Secondary (`SecondaryButtonStyle`):** Transparent fill, hairline `outlineVariant` border, primary text color. Same dimensions as Primary.
- **Destructive (`DestructiveButtonStyle`):** Solid `Color.destructivePrimary` fill, white text. Same dimensions. _Only_ for irreversible actions.
- **Icon (`IconButtonStyle`):** Transparent, 44×44pt minimum hit area, `contentShape(Rectangle())`.
- **Icon Circle (`CircleIconButtonStyle`):** Same as Icon but `contentShape(Circle())`.
- **Text Link (`TextLinkButtonStyle`):** Pressed-feedback only, no forced height. Container spacing provides the tap target.
- **Plain Pressed (`PlainPressedButtonStyle`):** Pressed feedback only. For chips and custom layouts that manage their own shape.
- **Pressed state:** opacity `0.8` (`DesignTokens.Opacity.pressed`), eased over 0.2s.

### Chips & Pills (PulpeChip atom)

The Budget Detail filter rail uses `PulpeChip` (`ios/Pulpe/Shared/Components/PulpeChip.swift`) with three styles and two sizes. **Feature code never composes chips ad-hoc** — SwiftLint custom rule `no_adhoc_capsule_chip` enforces this.

- **`PulpeChip.Style.solid`:** `Color.textPrimary` fill, `Color(.systemBackground)` text, count badge in `Color(.systemBackground).opacity(0.2)` capsule. Used for the active filter pill.
- **`PulpeChip.Style.outlined`:** `Color.surface` fill, hairline `Color.onSurfaceVariant.opacity(outlinePill)` border, primary text. Used for inactive filter pills, the leading menu chip, and most chip-shaped controls.
- **`PulpeChip.Style.muted`:** `Color.surfaceContainerHigh` fill, no border. Reserved for stat / informational chips on tinted hero surfaces or cards — **never on the bare `appBackground`**, where the fill is indistinguishable from the canvas (1.04:1).
- **`PulpeChip.Style.semantic(_:)`:** **the default for any state or informational chip.** One semantic color carries both the wash (`Opacity.badgeBackground`) and the ink. Savings green (`financialSavings`) covers the whole savings-and-planning family — the goal status badge, the "Objectif : X" link on a saving prévision, and the "Lissé" / "Dépense lissée" chips. A trailing chevron takes no color of its own so it inherits the chip's ink.
- **`PulpeChip.Style.tinted(surface:foreground:)`:** explicit fill + ink pair, no border. Reserved for the cases `.semantic` can't express, where wash and ink are deliberately different colors: the dashboard hero (`HomeHeroCard`) and the paused savings goal (neutral wash, readable secondary ink). The chosen pair must separate from the actual backdrop.
- **`PulpeChip.Size.standard`:** ~40pt visual, padding `(lg, md)` from `ChipMetrics.Standard`. Pulpe default.
- **`PulpeChip.Size.prominent`:** ~48pt visual, padding `(xl, lg)`. Used for the dominant action chip on a screen.
- **No `.compact`:** Pulpe pillar `Légèreté` excludes tight density.
- **Disabled state:** `opacity(DesignTokens.Opacity.disabled)`, no tap, no haptic. Used on filter pills with count = 0 (except `.all`).

Hero metrics are `HeroMetricTile`s (translucent `heroTile` fill), never chips.

### Segmented Choice (SegmentedPicker)

Every 1-of-N control (nature, Une seule fois / Lisser, Total / Par mois, Devise, Statut)
goes through `SegmentedPicker` (`ios/Pulpe/Shared/Components/SegmentedPicker.swift`) — never
free-floating pills, whose unselected options read as bare text and blur into the chip
families around them.

- **Rendering is native:** the wrapper delegates to `Picker(.segmented)`, so track, thumb,
  ink, typography, and selection animation are the OS's and stay aligned across releases.
  The track is still what separates segmented _choices_ from chip _actions_
  (`QuickAmountChips`, month chips, `PulpeChip`).
- **Labels are plain `Text`** (emoji allowed — Devise reads `🇨🇭 CHF`): `UISegmentedControl`
  flattens any richer view into extra segments. Deliberate concession: no per-context
  accent ink on the selected label — the native control does not expose it per instance.
- The wrapper adds the optional form-field title (`labelMedium` / `onSurfaceVariant`) and
  `.sensoryFeedback(.selection)`; nothing else.

### Card Deck (UncheckedOperationsCard)

The dashboard's "Opérations à pointer" section is a horizontal, paginated deck of
quick-check cards, one operation per card ("C'est passé" / "Plus tard") — built from
`ScrollView(.horizontal)` + `.viewAligned` snapping, not a carousel library
(`ios/Pulpe/Features/CurrentMonth/Components/UncheckedOperationsCard.swift`).

- **Role:** replaces a single flat pane once there is more than one operation to point,
  so a page that used to grow with the list stays one card tall. Only the focused card is
  interactive; VoiceOver still reaches every real card in order.
- **Peek:** the deck escapes the page's `Spacing.xxl` content rail and re-applies the same
  token as a scroll content margin, so the focused card sits exactly on the rail while its
  neighbours peek at the screen edges — tucked tickets, not a hint arrow or dots.
- **Motion (`DesignTokens.Deck`):** a tucked neighbour shrinks by `tuckScaleDrop` (0.1),
  turns `turnDegrees` (8°) around the vertical axis anchored on its inner edge, and fades
  by `tuckFade` (0.35) — the combination reads as a card turning away, not sliding off.
  Anchoring on the inner edge (not centre) keeps the peek width intact through the shrink
  and grows the 3D turn toward the screen edge instead of swelling over the focused card.
- **Reduce Motion:** the 3D turn is suppressed (`phase.value * 0` in effect); scale and
  fade — resting states that only track the user's own finger — still play, since they
  read as position, not motion.
- **Loop:** the deck is a cycle — a turn past either end comes out on the other side —
  built from three concatenated copies of the card list so a one-cycle offset shift is
  pixel-invisible. Confirming a card plays its exit and the deck's slide to the next
  operation in one animated transaction.

### Kind Tag (Inline Label)

- **Style:** 10pt Manrope ExtraBold, uppercased, tracking `0.7px`, semantic financial color (income blue, saving green, expense neutral `textSecondary`).
- **Why neutral expense color:** _Le rouge n'est pas punitif_. Even the kind tag for expense lines uses neutral ink rather than amber, because the _amount column_ already carries the amber.

### Cards / Containers

- **Per-Row Card (Budget Line / Transaction Row):** `surfaceContainerLowest` background, `cornerRadius.xl` (32pt), `Shadow.subtle`. `padding.md` vertical, `padding.xs` leading (PointCircle), `padding.md` trailing. Pointed (checked) state dims to `0.62` opacity with strikethrough. Tap on circle toggles pointed; tap on row opens the detail sheet.
- **Hero Card (Budget Detail):** **Flat** — no surface, no border, no shadow. Sits flush on `appBackground`. Content: eyebrow (`DISPONIBLE · CHF`), hero amount (Manrope 72pt black on neutral), inline progress bar + percent, horizontal scroll of stat pills.
- **Hero Surface (Dashboard — `HomeHeroCard`):** Estimated month-end summary with no card, border or shadow, on a mint surface bounded by the hero's own content: the gradient stops at the block's measured bottom edge and its lower corners are rounded, so nothing depends on a fraction of the screen height. The estimate is unsigned unless negative, split into a dominant figure and a secondary currency suffix on one baseline. Two metrics — unchecked count, variance against plan — each carry their value over their own label. One plain-language verdict ends in the drill-in to budget detail, marked by ink and a chevron; the unchecked count is stated once per screen and never duplicated by a section header.

  The 120pt burn-down holds no text of its own, so its height is fixed and its two labels are capped rather than scaled. The tracked series is `homeHeroInk` at full strength; the projection is the same ink at `heroInkMuted`, with dashes as a secondary signal only — every graphic element clears 3:1 against the surface in both schemes. No rule is drawn for the plan or for today: the line's first reading is the plan and the dot is today. Past today the dashed stroke is the trend — the pace at which the month has left its plan, carried over the days left and shrunk toward the plan by how few days are known (`BalanceTrajectory.trendBalance`, `Chart.trendPriorDays`) — and names its landing `à ce rythme …` once it is visibly apart from the estimate. The hero figure stays the estimate; the trend is the second number, never the first. The anchor point names the gap to the plan when the plot has room for it, `Aujourd’hui` otherwise, pushed back inside the plot when a late-period anchor would clip it, and the destination point carries no label. With nothing pointed the trajectory is flat, so no connector is drawn and the empty band says what it waits for. Amount masking, a spoken trajectory for VoiceOver and Dynamic Type stacking are mandatory.

- **Hero Card (Previous Budget sheet):** Gradient background keyed to financial state (Comfortable / Tight / Deficit), `cornerRadius.xl` (32pt), `Shadow.elevated`.
- **Context Link Row (`ContextLinkRow`):** Tappable card linking a detail screen to the set its subject belongs to — the occurrences of a lissage, the objectif a prévision funds. Semantic icon (`actionIcon`, financial tint) → title (`listRowTitle`, `textPrimary`, wraps rather than truncates) → `chevron.right` (`caption`, `textTertiary`). Carries its **own** surface via `pulpeCard()`, never the host's: the same row sits in a `List` and in a `ScrollView`, and a host-provided background renders it as a full-bleed system band in one and a bare line in the other. Hosting it in a `List` therefore needs `.listRowCustomStyled()` + `.listSectionSeparator(.hidden)`.

### Inputs

- **Form Text Field (`FormTextField`):** `Color.inputBackgroundSoft` fill, `cornerRadius.md` (24pt), `padding.lg` (16pt all around). Optional label above (`labelMedium`, `onSurfaceVariant`). Tapping anywhere on the padded background focuses the field via `.contentShape(.interaction, Rectangle())` + `onTapGesture`.
- **Hero Amount Field (`HeroAmountField`):** Custom amount input with display amount logic.

### Sheets

- **Sheet Form Container (`SheetFormContainer`):** `NavigationStack > ScrollView > VStack`. Inline navigation title, leading close button (`SheetCloseButton`), `sheetBackground` background, `padding.xl` horizontal + `padding.lg` top + `padding.xl` bottom. Auto-focuses the first field after 200ms. Always declared with `.standardSheetPresentation()`.
- **Detents:** Default `[.large]`; explicit `[.medium, .large]` only when partial-detent Liquid Glass is desired.

### Navigation

- **NavigationStack (typed destinations):** `NavigationStack(path: $path)` with feature-scoped `enum Destination: Hashable`. Never `NavigationView` (deprecated). Never `NavigationLink` without typed destination.
- **Tab Bar (`MainTabView`):** Native SwiftUI `TabView` with exactly four navigation destinations: Accueil, Budgets, Objectifs and Modèles. The system owns its material, safe-area reservation and keyboard adaptation. Never place a creation action in the tab bar or replace the system bar with custom chrome.
- **Contextual creation:** The owner screen presents the action closest to the object it creates. Accueil uses a visible, labelled content action for an operation. Budget detail uses a native `topBarTrailing` toolbar action for a forecast. Root lists use their native toolbar action; local form additions stay inside their section. Every icon-only action has an explicit accessibility label and a 44pt minimum target.
- **Visibility:** Follow the system `TabView` behavior. Do not derive tab-bar visibility from navigation depth or keyboard notifications; hide it only when an explicit immersive flow requires it.
- **Sheet Forms vs Push:** Sheets for modal forms and detail edits. Push for hierarchical content (budget → budget detail → line detail). `.fullScreenCover` for immersive flows (auth, onboarding).

### iOS-Specific Named Rules

**The No Magic Values Rule.** Every visual value flows through `DesignTokens.*` (spacing, corner radius, opacity, animation, border width, frame heights, icon sizes, chip metrics) or `Color.*` from `Color+Pulpe`. Raw `#000`, raw `Color.white`, raw padding `16`, raw radius `12`, raw `lineWidth: 2` are all **prohibited**. If no token matches, add a named token to `DesignTokens` first, then use it.

**The Tap Target Rule (iOS).** Every interactive element has a 44×44pt minimum hit area (Apple HIG). The `frame(minHeight: 44)` goes on the **Button**, never inside the label — putting it on the label inflates the visible background. Pair with `.contentShape(...)` so the full hit area is tappable. Icon buttons use `IconButtonStyle()` or `CircleIconButtonStyle()` which encode this.

**The Form Rule.** Every add or edit form reads top to bottom in the same order: the segmented choices the form needs (nature, once/spread, total/monthly, recurrence), the hero amount with its quick chips, a "what" `FormCard` (description, tags), a "details" `FormCard` (date, pointed, goal or origin), then one primary CTA (flat in a sheet, sticky on a page). Atoms inside a card wear `style: .row`; a form-specific block such as the spread section sits below the details card. A card that would be empty is not drawn.

**The Chip Composition Rule (iOS implementation).** Chips and pills are **never** composed ad-hoc from `Capsule().fill(...)` + padding + text in feature code. They go through `PulpeChip` in `Shared/Components/`. SwiftLint rule `no_adhoc_capsule_chip` (warning) enforces this; legacy decorative shapes (progress bars, hero accents, toast rails) are explicitly excluded by path. New ad-hoc chips fail the lefthook gate.

## 6. Do's and Don'ts (iOS-specific)

### Do:

- **Do** route every visual value through `DesignTokens.*` (Spacing/CornerRadius/Opacity/Animation/BorderWidth/FrameHeight/IconSize/ChipMetrics) or `Color+Pulpe` semantic colors.
- **Do** apply `.standardSheetPresentation()` on every sheet — without it, iOS 26 Liquid Glass bleeds through.
- **Do** put `frame(minHeight: 44)` on the **Button** (not the label) and pair with `.contentShape()`.
- **Do** use `Color.financialIncome` / `Color.financialSavings` / `Color.financialExpense` for category accents, and `Color.financialOverBudget` for envelopes that have actually overrun.
- **Do** use `PrimaryButtonStyle` / `SecondaryButtonStyle` / `DestructiveButtonStyle` / `IconButtonStyle` / `TextLinkButtonStyle` / `PlainPressedButtonStyle` / `CircleIconButtonStyle` — never hand-roll a button.
- **Do** use Manrope (`PulpeTypography.amountHero`, `.headline`, `.kindTag`) for display, brand titles, and amount text. Use SF Pro (system) for everything else.
- **Do** use `monospacedDigit()` on every `Text` rendering a Decimal.
- **Do** use `PulpeChip(...)` for any chip / pill / filter / badge in feature code.
- **Do** keep the emotion zone at the top (constant forest surface, state in the verdict) and the content zone below (neutral warm), bounded by `CornerRadius.zone` and `Shadow.zoneBoundary`.
- **Do** address the user with "tu", always.

### Don't:

- **Don't** use raw `Color.white` or `#000` — use `Color(.systemBackground)` and `Color.textPrimary`.
- **Don't** apply `.glassEffect()` to content cards, list rows, or text. Glass is for navigation chrome only.
- **Don't** compose chips or pills from raw `Capsule().fill(...)` + padding ad-hoc — go through `PulpeChip`. SwiftLint will block it.
- **Don't** write magic numeric values for visual properties. `.padding(16)`, `.cornerRadius(12)`, `.opacity(0.5)`, `lineWidth: 2`, `.easeInOut(duration: 0.3)` — all forbidden. Use the token.
- **Don't** put `frame(minHeight: 44)` inside a Button's label — it inflates the visible background to 44pt.
- **Don't** ship a sheet without an explicit `.presentationBackground(...)` — iOS 26 will bleed glass through it.
- **Don't** use `asCompactCurrency` on the Budget Detail page — two decimals everywhere there.
- **Don't** use anxiety red anywhere except the dashboard hero deficit (>100% spent).
- **Don't** invent new chip vocabulary — extend `PulpeChip.Style` if a new visual variant is needed.
