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
  app-background: "#F2F1EC"
  sheet-background: "#F6F5F1"
  surface: "#FFFFFF"
  sunk: "#ECEAE4"
  accent-wash: "#E2F0E5"
  accent-ink: "#0B4F1E"
  over-wash: "#F6EBDB"
  coral: "#C45028"
  coral-wash: "#FAE6DE"
  text-primary: "#1A1C19"
  text-secondary: "#4A4540"
  text-tertiary: "#77706A"
  outline: "#CFC8BC"
  outline-variant: "#E6E2DA"
  point-ring: "#8F877C"
  destructive-wash: "#FBE7E6"
  hero-comfortable: "#14AD45"
  hero-tight: "#D88010"
  hero-deficit: "#C45028"
  home-background: "#F2F1EC" # alias of app-background — the shared canvas
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
  surface: "22px"
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
    height: "52px"
  button-secondary:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "52px"
  button-tertiary:
    backgroundColor: "transparent"
    textColor: "{colors.pulpe-primary}"
    typography: "{typography.button}"
    height: "44px"
  button-destructive:
    backgroundColor: "{colors.destructive-wash}"
    textColor: "{colors.destructive}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "52px"
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
    backgroundColor: "{colors.sunk}"
    rounded: "{rounded.pill}"
    padding: "3px"
  segmented-picker-thumb:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    height: "36px"
  chip-filter-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    height: "36px"
  chip-filter-unselected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.metric-label}"
    rounded: "{rounded.pill}"
    height: "36px"
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
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "14px"
    height: "50px"
---

# Design System: Pulpe iOS

> **Doc graph**
>
> - **Strategic foundation:** [../PRODUCT.md](../PRODUCT.md)
> - **Cross-platform visual common:** [../DESIGN.md](../DESIGN.md) — read first; this file inherits everything there
> - **This file:** iOS-native extensions (refonte V2) — tokens, components, Liquid Glass, sheets, SwiftUI patterns
> - **Sibling platforms:** [../frontend/DESIGN.md](../frontend/DESIGN.md), [../landing/DESIGN.md](../landing/DESIGN.md)
> - **No sidecar:** `/impeccable live` (which consumes `.impeccable/design.json`) is browser-only and unsupported on SwiftUI. iOS visual canon lives in this file alone.
>
> Everything in this doc is iOS-only. Cross-platform rules live in `../DESIGN.md` and are not repeated here.

## 1. Overview: iOS Native, Paper Canvas, Tokens-First

iOS is the dominant Pulpe surface. SwiftUI native, iOS 18 deployment target with iOS 26 features behind `#available`. Liquid Glass on navigation only. Every visual value flows through `DesignTokens` (`ios/Pulpe/Shared/Design/DesignTokens.swift`) or `Color+Pulpe` (`ios/Pulpe/Shared/Extensions/Color+Pulpe.swift`); the project rule forbids raw design values, while SwiftLint enforces selected architecture and timing constraints.

**Stack:** SwiftUI + Swift 6 strict concurrency + Xcode (XcodeGen-driven `.xcodeproj`). Tests in Swift Testing (`@Suite` / `@Test` / `#expect`). Lefthook + SwiftLint pre-commit gates.

**iOS-specific characteristics:**

- Deployment target iOS 18, iOS 26 features (Liquid Glass, `.contentTransition(.symbolEffect(.replace))`) gated with `#available`
- Apple HIG 44pt tap target — `frame(minHeight:)` on the **Button**, never on the label
- V2 reading rules: green acts, ink reads, ocre says "dépassé", red only deletes; one row grammar (pointing circle left, chevron right)
- Sheets always declare `.standardSheetPresentation()` to prevent iOS 26 glass bleed
- Compositions tokens layer (`DesignTokens.ChipMetrics`) sits between primitives and feature surfaces

## 2. Colors: Resolved iOS Hex

The seeds in `../DESIGN.md` are abstract. The values below are the **iOS canonical hex** used in `Color+Pulpe`. Light mode unless noted; dark mode uses dynamic counterparts.

### Brand and action

**Green acts, ink reads.** One action colour carries every control; text and amounts are ink, never green or black-on-green.

- **Action** (`#006E25`): `Color.pulpePrimary`. Primary button, FAB, pointed disc, links, focus ring, switch. Dark: `#7EDB83`. White on it is 6.4:1.
- **Action wash** (`#E2F0E5`, dark `#1F3B27`): `Color.accentWash`. Secondary button, selected chip, empty-state disc.
- **Action ink** (`#0B4F1E`, dark `#A6E6AA`): `Color.accentInk`. Text and glyphs on the wash.

### Financial Accents (bars and dots only)

- **Income** (`#0061A6`): `Color.financialIncome`. **Savings** (`#157038`): `Color.financialSavings`. **Expense** (`#B35800`): `Color.financialExpense`. Amounts stay ink; the nature is read on bars, dots and section headers.
- **Over / ocre** (`#905800`, dark `#E5A33A`): `Color.financialOverBudget`, wash `#F6EBDB` (dark `#3A2A10`): `Color.overWash`. "Dépassé" in words, never red.
- **Coral** (`#C45028`, dark `#E8825A`): `Color.coral`, wash `#FAE6DE` (dark `#3A1D12`): `Color.coralWash`.

### Hero Zone (legacy, until the screens are rebuilt)

The forest hero is no longer the default surface. These tokens stay only for the screens not yet migrated to the V2 canvas.

The hero surface is the brand forest, never tinted by financial state. Ratios measured by `HeroContrastTests` (WCAG 2.1, text 4.5:1, non-text 3:1):

| Token                      | Light                                 | Dark      | Ratio on `heroSurface`    |
| -------------------------- | ------------------------------------- | --------- | ------------------------- |
| `Color.heroSurface`        | `#0E3A1C`                             | `#0B2E16` | 11.4:1 vs `appBackground` |
| `Color.heroSurfaceTop`     | `#14512A`                             | `#0E3A1C` | top gradient stop         |
| `Color.heroInk`            | `#FFFFFF`                             | `#F3F9F5` | 12.8:1                    |
| `Color.heroInkSecondary`   | `#CFE8D6`                             | `#CFE8D6` | 9.9:1                     |
| `Color.heroTile`           | `heroInk` @ `Opacity.heroTile` (0.12) | same      | surface, not a signal     |
| `Color.heroAccentPositive` | `#7EDB83`                             | same      | 7.5:1                     |
| `Color.heroAccentCaution`  | `#E5A33A`                             | same      | 5.9:1                     |
| `Color.heroAccentDeficit`  | `#F08A6A`                             | same      | 5.2:1                     |
| `Color.heroAccentInfo`     | `#5AA8E0`                             | same      | 4.9:1                     |

The previous state-tinted heroes (`#14AD45`, `#D88010` under white ink) measured 2.96:1 and 2.99:1 — refused.

### Surface

- **Canvas / bg** (`#F2F1EC`): `Color.appBackground`. Dark: `#121611`. Warm paper, the default surface of every screen.
- **Card** (`#FFFFFF`, dark `#1A1816`): `Color.surface`. Radius 22, soft two-layer shadow (`pulpeSurfaceCard()`).
- **Sheet** (`#F6F5F1`): `Color.sheetBackground`.
- **Sunk** (`#ECEAE4`, dark `#2A2826`): `Color.sunk` (= `surfaceContainerHigh`). Segmented track, impact block, neutral banner, settings tile.

### Text

- **Ink** (`#1A1C19`, dark `#F5F3EF`): `Color.textPrimary`. Text and amounts. Never `#000`, never a fill.
- **Ink 2** (`#4A4540`, dark `#C4BCB3`): `Color.textSecondary`. Captions, 13pt minimum, 8.4:1.
- **Ink 3** (`#77706A`, dark `#A39C94`): `Color.textTertiary`. Placeholders, struck-through "before" figures, chevrons. Never the only carrier of meaning.

### Lines

- **Line** (`#E6E2DA`, dark `#3A3733`): `Color.outlineVariant`. Row dividers, form-card border.
- **Line 2** (`#CFC8BC`, dark `#4A4640`): `Color.outline`. Input and unselected-chip border.
- **Ring** (`#8F877C`, dark `#8A837A`): `Color.pointRing`. The unpointed circle, 3:1 on white.

### Destructive

- **Red** (`#C62828`, dark `#FF6B6B`): `Color.destructivePrimary`, wash `#FBE7E6`: `Color.destructiveBackground`. Delete, and nothing else.

### iOS-Specific Named Rules

**The Paper Canvas Rule.** Every screen sits on `Color.appBackground` with white cards (`pulpeSurfaceCard()`); the forest hero zone (`heroZone()` / `contentZone()`) survives only on screens not yet rebuilt and is not a pattern to copy. The month and the account live in the native navigation bar.

**The One Hero Rule (legacy).** Every surface with a dominant financial state (home, budget detail, yearly view, savings-goal detail) composes its hero from the shared `HeroZone` family (`heroZone()` / `contentZone()`, `HeroFigure`, `HeroMetricTile`, `HeroVerdictRow`). No screen draws its own hero grammar.

**The One Ledger Rule.** Every list is a grouped card, rows separated by hairlines (`Color.outlineVariant`). A row is `PulpeListRow`: leading 28pt `PointCircle` (2pt `pointRing` ring; pointed = `pulpePrimary` disc + white check), 16pt semibold title, one 13pt `ink2` fact, trailing Manrope 700 16pt amount in ink, `RowChevron` when the row opens something, 60pt minimum. No category icons in rows. A pointed row keeps full opacity: no dim, no strikethrough. The circle is the pointing control; a leading swipe on the row is the second path to the same toggle.

**The Three Families Rule.** At most three chip families are visible on a screen. Any 1-of-N choice is a `SegmentedPicker`. `PulpeChip.muted` never sits on the bare canvas. Hero stat pills are `HeroMetricTile`s, not chips.

**The Home Ledger Rule.** Everything on the page is a **titled block on a card**, never a run of rows on the bare page. A section names itself with `SectionHeader` — the section title, an optional amount under it, and, when there is somewhere to go, a **named** link (`Tout voir`, `Budget`) rather than a bare chevron. That header sits on the page background, outside the card, so the card boundary marks where the section's content starts. Under it, one card (`pulpeRowCard()` — the shared card fill plus the subtle lift) carries the rows. A row opens on its pointing circle or its name, never on a category icon. A hairline may separate rows **inside** a card and nothing else — on the bare page a rule divides nothing and reads as unfinished. Activity groups its rows by day, the day named once above its card instead of repeated under every row. `SectionHeader` owns the screen's only Dynamic Type branch; the rows below it wrap rather than re-stack. The rule is not the home's alone: `SectionHeader` lives in `Shared/Components/`, the savings-goal detail names every one of its sections with it, and budget detail carries the same rail and the same `pulpeRowCard()` — a card with the fill but no lift reads as a different radius, not as a quieter one.

## 3. Typography: iOS Resolved Scale

Manrope for display + Pulpe amounts; SF Pro (system) for everything else. Dynamic Type respected on all body and label roles.

### Hierarchy (iOS values)

- **Hero** (Manrope 800, 52pt, tracking `-2`, tabular): `PulpeTypography.heroAmount`; currency suffix 0.42em, ink2 (`heroCurrencySuffix`).
- **Big** (Manrope 800, 36pt) and **Mid** (Manrope 800, 22pt): `bigAmount`, `midAmount`, each with its own suffix.
- **Large title** (SF 34 bold, tracking `-0.4`): `pageTitle`, with a 15pt ink2 subtitle (`PageHeader`).
- **Section** (20pt bold): `sectionTitle` / `statusTitle`.
- **Body** (SF 17): default content. **Button** (SF 17 semibold); small button and chip 15 semibold (`chipLabel`).
- **Row title** (SF 16 semibold): `rowTitle`. **Row amount** (Manrope 700, 16pt, tabular): `rowAmount`.
- **Caption** (SF 13, ink2): `captionRegular`. 13pt is the floor for any text.
- **Impact "after"** (Manrope 700, 17pt): `impactAmount`.
- Every amount uses tabular digits. All roles scale with Dynamic Type (`relativeTo:`).

Legacy display roles (`displayYear`, `dashboardHeroAmount`, `amountHero`…) remain for screens not yet rebuilt.

Live tokens: `ios/Pulpe/Shared/Styles/Typography.swift`.

### iOS-Specific Named Rules

**The Two-Decimals Rule (Budget Detail page).** On the iOS Budget Detail page, all currency amounts render with two decimals (`1'234.56 CHF`). `asCompactCurrency` (the rounded compact format) is **prohibited** in this context. Other surfaces apply the dual aggregation/ligne policy from the project's currency-formatting rule.

**Account reconciliation.** Its pointed-balance breakdown keeps spending and savings on separate rows, matching the existing iOS realized-balance sheet. Web and Android combine those rows as checked outflows; this is an intentional presentation difference, not a different formula. Both savings and spending are subtracted, and the total and verdict remain identical across platforms. Every reconciliation amount, including a one-cent gap, uses the user's currency with two decimals.

**The Hero Flat Rule.** The Budget Detail hero amount is `Manrope ExtraBold` rendered in `Color.textPrimary` (black on neutral). The hero is **flat** on the warm canvas — no surface, no border, no shadow. Color comes from the financial-state pill row beneath it, never from the hero number itself. The savings-goal detail hero obeys the same rule: the confirmed amount is `amountHero` in `Color.textPrimary`, and the only colour on it comes from the progress bar underneath.

## 4. Elevation

Pulpe iOS is **flat by default with restrained tonal layering**. Shadows are diffuse and warm-tinted; they never define structure, only state. Live tokens: `DesignTokens.Shadow`.

### Shadow Vocabulary

- **Card** (V2, two layers `0 1px 2px rgba(40,32,20,.06)` + `0 6px 20px -10px rgba(40,32,20,.16)`): `pulpeSurfaceShadow()`, white cards.
- **Floating action** (`0 8px 20px -8px rgba(0,80,30,.55)`): `Shadow.floatingAction`, the FAB only.
- **Subtle** (`0 1px 2px rgba(0,0,0,0.05)`): Legacy per-row card lift.
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

- **Shape:** Capsule, 52pt (`FrameHeight.button`), 17pt semibold. `.small` size: 40pt, 15pt, hit area still 44pt.
- **Primary (`PrimaryButtonStyle`):** `pulpePrimary` fill, `textOnPrimary` label; disabled = `primaryContainerDisabled`. One per screen. Never black.
- **Secondary (`SecondaryButtonStyle`):** `accentWash` fill, `accentInk` label, no outline.
- **Tertiary (`TertiaryButtonStyle`):** green text, 44pt, no fill.
- **Destructive (`DestructiveButtonStyle`):** `destructiveBackground` fill, red label. Only for irreversible actions.
- **Icon / Icon Circle / Text Link / Plain Pressed:** unchanged (44pt minimum hit area, pressed opacity).
- **Press feedback:** scale `0.96` on the capsule buttons (`Animation.pressedButtonScale`), none under Reduce Motion.

### Chips & Pills (PulpeChip atom)

The Budget Detail filter rail uses `PulpeChip` (`ios/Pulpe/Shared/Components/PulpeChip.swift`) with three styles and two sizes. **Feature code never composes chips ad-hoc** — SwiftLint custom rule `no_adhoc_capsule_chip` enforces this.

- **`PulpeChip.Style.selected`:** on. `accentWash` fill, 1.5pt `pulpePrimary` ring, `accentInk` label, leading check (unless the chip has its own icon). Never solid black.
- **`PulpeChip.Style.outlined`:** off, default. `surface` fill, 1pt `outline` (line2) inset border, ink label.
- **`PulpeChip.Style.muted`:** `Color.surfaceContainerHigh` fill, no border. Reserved for stat / informational chips on tinted hero surfaces or cards — **never on the bare `appBackground`**, where the fill is indistinguishable from the canvas (1.04:1).
- **`PulpeChip.Style.semantic(_:)`:** **the default for any state or informational chip.** One semantic color carries both the wash (`Opacity.badgeBackground`) and the ink. Savings green (`financialSavings`) covers the whole savings-and-planning family — the goal status badge, the "Objectif : X" link on a saving prévision, and the "Lissé" / "Dépense lissée" chips. A trailing chevron takes no color of its own so it inherits the chip's ink.
- **`PulpeChip.Style.tinted(surface:foreground:)`:** explicit fill + ink pair, no border. Reserved for the cases `.semantic` can't express, where wash and ink are deliberately different colors: the dashboard hero (`HomeHeroCard`) and the paused savings goal (neutral wash, readable secondary ink). The chosen pair must separate from the actual backdrop.
- **`PulpeChip.Size.standard` / `.prominent`:** both 36pt visual (`FrameHeight.chip`), 44pt hit area padded out and back in; `.prominent` only widens the horizontal padding.
- **No `.compact`:** Pulpe pillar `Légèreté` excludes tight density.
- **Disabled state:** `opacity(DesignTokens.Opacity.disabled)`, no tap, no haptic. Used on filter pills with count = 0 (except `.all`).

Hero metrics are `HeroMetricTile`s (translucent `heroTile` fill), never chips.

### Segmented Choice (SegmentedPicker)

Every 1-of-N control (nature, Une seule fois / Lisser, Total / Par mois, Devise, Statut)
goes through `SegmentedPicker` (`ios/Pulpe/Shared/Components/SegmentedPicker.swift`) — never
free-floating pills, whose unselected options read as bare text and blur into the chip
families around them.

- **Rendering:** a `sunk` capsule track with 3pt padding, 36pt segments; the selected segment is a `surface` capsule with a small shadow and ink text, the others ink2. Built from buttons (44pt hit area, `.isSelected` trait, Reduce Motion respected), so the track still separates segmented _choices_ from chip _actions_.
- **Labels are plain `Text`** (emoji allowed — Devise reads `🇨🇭 CHF`).
- The wrapper adds the optional form-field title (13pt semibold ink2) and `.sensoryFeedback(.selection)`.

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

- **Per-Row Card (Budget Line / Transaction Row):** a `PulpeListRow` inside a grouped white card. Pointed rows keep full opacity (no dim, no strikethrough). Tap on circle toggles pointed; tap on row opens the detail sheet.
- **Hero Card (Budget Detail):** **Flat** — no surface, no border, no shadow. Sits flush on `appBackground`. Content: eyebrow (`DISPONIBLE · CHF`), hero amount (Manrope 72pt black on neutral), inline progress bar + percent, horizontal scroll of stat pills.
- **Hero Surface (Dashboard — `HomeHeroCard`):** Estimated month-end summary with no card, border or shadow, on a mint surface bounded by the hero's own content: the gradient stops at the block's measured bottom edge and its lower corners are rounded, so nothing depends on a fraction of the screen height. The estimate is unsigned unless negative, split into a dominant figure and a secondary currency suffix on one baseline. Two metrics — unchecked count, variance against plan — each carry their value over their own label. One plain-language verdict ends in the drill-in to budget detail, marked by ink and a chevron; the unchecked count is stated once per screen and never duplicated by a section header.

  The 120pt burn-down holds no text of its own, so its height is fixed and its two labels are capped rather than scaled. The tracked series is `homeHeroInk` at full strength; the projection is the same ink at `heroInkMuted`, with dashes as a secondary signal only — every graphic element clears 3:1 against the surface in both schemes. No rule is drawn for the plan or for today: the line's first reading is the plan and the dot is today. Past today the dashed stroke is the trend — the pace at which the month has left its plan, carried over the days left and shrunk toward the plan by how few days are known (`BalanceTrajectory.trendBalance`, `Chart.trendPriorDays`) — and names its landing `à ce rythme …` once it is visibly apart from the estimate. When the backend has closed months to read, the trend leans toward where this user usually lands (`DriftHistory`: usual drift rate, its strength in days, a cap), flat before day 7; while the server settles an entry added from the home, the dashed stroke and its label pulse at the skeleton's low opacity, then spring to the new end (crossfade under reduced motion). The hero figure stays the estimate; the trend is the second number, never the first. The anchor point names the gap to the plan when the plot has room for it, `Aujourd’hui` otherwise, pushed back inside the plot when a late-period anchor would clip it, and the destination point carries no label. With nothing pointed the trajectory is flat, so no connector is drawn and the empty band says what it waits for. Amount masking, a spoken trajectory for VoiceOver and Dynamic Type stacking are mandatory.

- **Hero Card (Previous Budget sheet):** Gradient background keyed to financial state (Comfortable / Tight / Deficit), `cornerRadius.xl` (32pt), `Shadow.elevated`.
- **Context Link Row (`ContextLinkRow`):** Tappable card linking a detail screen to the set its subject belongs to — the occurrences of a lissage, the objectif a prévision funds. Semantic icon (`actionIcon`, financial tint) → title (`listRowTitle`, `textPrimary`, wraps rather than truncates) → `chevron.right` (`caption`, `textTertiary`). Carries its **own** surface via `pulpeCard()`, never the host's: the same row sits in a `List` and in a `ScrollView`, and a host-provided background renders it as a full-bleed system band in one and a bare line in the other. Hosting it in a `List` therefore needs `.listRowCustomStyled()` + `.listSectionSeparator(.hidden)`.

### Inputs

- **Input (`FormTextField`, `AuthTextField`, `CurrencyField`):** `surface` fill, 14pt radius, 1pt `outline` border, 50pt minimum height, 17pt text; focused = 2pt `pulpePrimary` border. Optional label above (13pt semibold ink2). Tapping anywhere on the field focuses it via `.contentShape(.interaction, Rectangle())` + `onTapGesture`.
- **Form Card (`FormCard`):** white, 18pt radius, 1pt `outlineVariant` border, 52pt rows (`ListRow.formRowHeight`) separated by `FormRowDivider`.
- **Hero Amount Field (`HeroAmountField`):** Custom amount input with display amount logic.

### V2 building blocks

- **`PulpeListRow`:** the row grammar above. **`SectionAddRow`:** 52pt "add a prévision" row, green 15pt semibold text, 28pt `accentWash` disc with a plus.
- **`ImpactBlock`:** what an action does to a figure: `sunk`, radius 16, caption title, struck-through "before" in ink3 → "after" Manrope 700 17pt, optional caption.
- **`InfoBanner`:** radius 16, 15pt; `.neutral` (sunk), `.over` (over-wash, ocre glyph), `.ok` (accent wash), `.err` (red wash, red glyph). Never a button.
- **`PulpeEmptyState`:** 56pt `accentWash` disc, 20pt bold title, one 15pt ink2 sentence, one small primary action. **`StatusScreen`:** the full-screen version for maintenance, error and update.
- **`SettingsRow`:** 32pt `sunk` tile (radius 9, ink2 glyph), title, ink2 value, chevron. **`PageHeader`:** 34pt bold large title and 15pt ink2 subtitle.
- **Toast:** white card radius 20, soft shadow, green icon, bold green action.

### Sheets

- **Sheet Form Container (`SheetFormContainer`):** `NavigationStack > ScrollView > VStack`. Inline navigation title, leading close button (`SheetCloseButton`), `sheetBackground` background, `padding.xl` horizontal + `padding.lg` top + `padding.xl` bottom. Auto-focuses the first field after 200ms. Always declared with `.standardSheetPresentation()`.
- **Detents:** Default `[.large]`; explicit `[.medium, .large]` only when partial-detent Liquid Glass is desired.

### Navigation

- **NavigationStack (typed destinations):** `NavigationStack(path: $path)` with feature-scoped `enum Destination: Hashable`. Never `NavigationView` (deprecated). Never `NavigationLink` without typed destination.
- **Tab Bar (`MainTabView`):** Native SwiftUI `TabView` with exactly four navigation destinations: Accueil, Budgets, Objectifs and Modèles. The system owns its material, safe-area reservation and keyboard adaptation. Never place a creation action in the tab bar or replace the system bar with custom chrome.
- **Mon patrimoine:** a pushed page (`NetWorthDestination`) from a `ContextLinkRow` at the end of the Objectifs list, shown only behind the `net_worth` flag. Never a fifth tab.
- **Floating add (`FloatingAddButton`):** one global "+" on the four root tab screens, bottom trailing above the tab bar: 62pt solid `pulpePrimary` circle (never glass), white 26pt plus, `Shadow.floatingAction`. Hidden on pushed pages. Root scroll content takes `pulpeRootBottomInset()` (120pt, `Layout.rootBottomInset`) so no row hides under the bar and the button.
- **Contextual creation:** The owner screen presents the action closest to the object it creates. Accueil uses a visible, labelled content action for an operation. Budget detail spends its one filled content action on adding a forecast, in the same shape and on the same `Spacing.xxl` rail the Accueil gives to recording an operation; the action that only reads the month back stays a bare `topBarTrailing` glyph, which iOS 26 dresses in its own Liquid Glass, so the two never compete for the same weight; a future month adds an `ellipsis.circle` overflow menu beside it that holds its one destructive entry, "Supprimer ce mois". Root lists use their native toolbar action; local form additions stay inside their section. Every icon-only action has an explicit accessibility label and a 44pt minimum target.
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
- **Do** use `PrimaryButtonStyle` / `SecondaryButtonStyle` / `TertiaryButtonStyle` / `DestructiveButtonStyle` / `IconButtonStyle` / `TextLinkButtonStyle` / `PlainPressedButtonStyle` / `CircleIconButtonStyle` — never hand-roll a button.
- **Do** use Manrope (`PulpeTypography.amountHero`, `.headline`, `.kindTag`) for display, brand titles, and amount text. Use SF Pro (system) for everything else.
- **Do** use `monospacedDigit()` on every `Text` rendering a Decimal.
- **Do** use `PulpeChip(...)` for any chip / pill / filter / badge in feature code.
- **Do** keep green for actions and ink for reading; say "dépassé" in ocre, never red.
- **Do** address the user with "tu", always.

### Don't:

- **Don't** use raw `Color.white` or `#000` — use `Color(.systemBackground)` and `Color.textPrimary`.
- **Don't** apply `.glassEffect()` to content cards, list rows, or text. Glass is for navigation chrome only.
- **Don't** compose chips or pills from raw `Capsule().fill(...)` + padding ad-hoc — go through `PulpeChip`. SwiftLint will block it.
- **Don't** write magic numeric values for visual properties. `.padding(16)`, `.cornerRadius(12)`, `.opacity(0.5)`, `lineWidth: 2`, `.easeInOut(duration: 0.3)` — all forbidden. Use the token.
- **Don't** put `frame(minHeight: 44)` inside a Button's label — it inflates the visible background to 44pt.
- **Don't** ship a sheet without an explicit `.presentationBackground(...)` — iOS 26 will bleed glass through it.
- **Don't** use `asCompactCurrency` on the Budget Detail page — two decimals everywhere there.
- **Don't** use red anywhere except delete. Overruns are ocre.
- **Don't** use black on a button, chip or disc, dim a pointed row, or draw category icons in rows.
- **Don't** invent new chip vocabulary — extend `PulpeChip.Style` if a new visual variant is needed.
