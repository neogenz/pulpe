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
  financial-over-budget: "#A86800"
  app-background: "#F7F6F3"
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

iOS is the dominant Pulpe surface. SwiftUI native, iOS 18 deployment target with iOS 26 features behind `#available`. Liquid Glass on navigation only. Every visual value flows through `DesignTokens` (`ios/Pulpe/Shared/Design/DesignTokens.swift`) or `Color+Pulpe` (`ios/Pulpe/Shared/Extensions/Color+Pulpe.swift`); raw values are forbidden by SwiftLint and project rule.

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
- **Over-Budget / Burnt Amber** (`#A86800`): `Color.financialOverBudget`.
- **Hero Deficit / Sunset Coral** (`#C45028`): `Color.heroTintDeficit`. Gradient mid-stop only.

### Surface (Warm Hierarchy)
- **App Background** (`#F7F6F3`): `Color.appBackground`. Dark mode: `#141210`.
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

**The Two-Zone Rule (iOS implementation).** Every screen with a hero is split. Top 30–35% is the **emotion zone** — `LinearGradient` filled, financial-state-keyed (`heroComfortable` / `heroTight` / `heroDeficit`). Below is the **content zone** — `Color.appBackground`, lists and cards on top. Transition is a soft `LinearGradient` 40–60pt, never a hard cut. Screens without a hero (templates, settings) skip the emotion zone entirely.

## 3. Typography: iOS Resolved Scale

Manrope for display + Pulpe amounts; SF Pro (system) for everything else. Dynamic Type respected on all body and label roles.

### Hierarchy (iOS values)

- **Display** (Manrope ExtraBold, 72pt, lh 1.0, tracking `-3px`): Year recap big number on the budget list.
- **Headline** (Manrope Bold, 34pt, lh 1.05, tracking `-0.6px`): Hero amount on the dashboard, brand titles.
- **Amount Hero** (Manrope ExtraBold, 34pt, lh 1.0, tracking `-1.2px`): The hero balance amount on `BudgetDetailsView`. Black on neutral, never colored.
- **Amount Card** (Manrope ExtraBold, 20pt): Per-row card amounts. Tabular figures via `monospacedDigit()`.
- **Title** (SF Pro Semibold, 22pt): Section titles, sheet titles.
- **Body** (SF Pro, 17pt): Default content, descriptions.
- **List Row Title** (SF Pro Semibold, 17pt): Budget line names, transaction descriptions.
- **Metric Label** (SF Pro Bold, 13pt): Pill text, chip labels, count badges.
- **Kind Tag** (Manrope ExtraBold, 10pt, tracking `0.7px`, uppercased): Inline `REVENU` / `ÉPARGNE` / `DÉPENSE` tags above row labels.
- **Label Medium** (SF Pro Medium, 13pt): Form field labels, secondary metadata.
- **Button** (SF Pro Semibold, 17pt): All button text.

Live tokens: `ios/Pulpe/Shared/Design/PulpeTypography.swift`.

### iOS-Specific Named Rules

**The Two-Decimals Rule (Budget Detail page).** On the iOS Budget Detail page, all currency amounts render with two decimals (`1'234.56 CHF`). `asCompactCurrency` (the rounded compact format) is **prohibited** in this context. Other surfaces apply the dual aggregation/ligne policy from the project's currency-formatting rule.

**The Hero Flat Rule.** The Budget Detail hero amount is `Manrope ExtraBold` rendered in `Color.textPrimary` (black on neutral). The hero is **flat** on the warm canvas — no surface, no border, no shadow. Color comes from the financial-state pill row beneath it, never from the hero number itself.

## 4. Elevation

Pulpe iOS is **flat by default with restrained tonal layering**. Shadows are diffuse and warm-tinted; they never define structure, only state. Live tokens: `DesignTokens.Shadow`.

### Shadow Vocabulary
- **Subtle** (`0 1px 2px rgba(0,0,0,0.05)`): Per-row card lift on the Budget Detail page.
- **Card** (`0 2px 4px rgba(0,0,0,0.06)`): Default card lift.
- **Elevated** (`0 4px 8px rgba(0,0,0,0.08)`): Hero cards, modals, dialog surfaces.
- **Input** (`0 2px 6px rgba(0,0,0,0.04)`): Auth and currency input field rest state.
- **Toast** (`0 4px 8px rgba(0,0,0,0.10)`): Toast notifications.

### iOS-Specific Named Rules

**The Glass Restraint Rule.** iOS 26 Liquid Glass appears on **navigation only** — toolbars, tab bars, floating buttons, sheets with partial detents. *Never* on content cards, list rows, or text. The system handles this for standard navigation components; custom views must `.glassEffect()` only on navigation chrome. Pre-auth flows (welcome, login, onboarding) may use glow / shadow for brand expressivity; the authenticated app stays restrained.

**The Sheet Background Rule.** Every sheet must declare `.standardSheetPresentation()` (which bundles `.presentationBackground(Color.sheetBackground)` + detents + drag indicator + corner radius). iOS 26's Liquid Glass bleeds through any sheet without an explicit presentation background. **No exceptions.** Custom-background sheets (gradient sheets like RecoveryKey) declare `.presentationBackground { ... }` explicitly.

## 5. Components

Live in `ios/Pulpe/Shared/Components/` and `ios/Pulpe/Shared/Design/PrimaryButtonStyle.swift`.

### Buttons
- **Shape:** Capsule (`pill` rounded, `9999px`). The capsule is the brand button.
- **Primary (`PrimaryButtonStyle`):** `Color.onboardingGradient` (forest → mint, leading→trailing) for enabled, `primaryContainerDisabled` for disabled. White text. Full-width, 54pt height. One per screen.
- **Secondary (`SecondaryButtonStyle`):** Transparent fill, hairline `outlineVariant` border, primary text color. Same dimensions as Primary.
- **Destructive (`DestructiveButtonStyle`):** Solid `Color.destructivePrimary` fill, white text. Same dimensions. *Only* for irreversible actions.
- **Icon (`IconButtonStyle`):** Transparent, 44×44pt minimum hit area, `contentShape(Rectangle())`.
- **Icon Circle (`CircleIconButtonStyle`):** Same as Icon but `contentShape(Circle())`.
- **Text Link (`TextLinkButtonStyle`):** Pressed-feedback only, no forced height. Container spacing provides the tap target.
- **Plain Pressed (`PlainPressedButtonStyle`):** Pressed feedback only. For chips and custom layouts that manage their own shape.
- **Pressed state:** opacity `0.8` (`DesignTokens.Opacity.pressed`), eased over 0.2s.

### Chips & Pills (PulpeChip atom)

The Budget Detail filter rail uses `PulpeChip` (`ios/Pulpe/Shared/Components/PulpeChip.swift`) with three styles and two sizes. **Feature code never composes chips ad-hoc** — SwiftLint custom rule `no_adhoc_capsule_chip` enforces this.

- **`PulpeChip.Style.solid`:** `Color.textPrimary` fill, `Color(.systemBackground)` text, count badge in `Color(.systemBackground).opacity(0.2)` capsule. Used for the active filter pill.
- **`PulpeChip.Style.outlined`:** `Color.surface` fill, hairline `Color.onSurfaceVariant.opacity(outlinePill)` border, primary text. Used for inactive filter pills, the leading menu chip, and most chip-shaped controls.
- **`PulpeChip.Style.muted`:** `Color.surfaceContainerHigh` fill, no border. Reserved for stat / informational chips on tinted hero surfaces.
- **`PulpeChip.Size.standard`:** ~40pt visual, padding `(lg, md)` from `ChipMetrics.Standard`. Pulpe default.
- **`PulpeChip.Size.prominent`:** ~48pt visual, padding `(xl, lg)`. Used for the dominant action chip on a screen.
- **No `.compact`:** Pulpe pillar `Légèreté` excludes tight density.
- **Disabled state:** `opacity(DesignTokens.Opacity.disabled)`, no tap, no haptic. Used on filter pills with count = 0 (except `.all`).

Stat pills on hero cards use `Capsule + tint.opacity(0.15)` background keyed to financial category — currently still composed locally in `BudgetDetailHero` (legacy, audited 2026-05-09; migration to `PulpeChip.muted` is a follow-up).

### Kind Tag (Inline Label)
- **Style:** 10pt Manrope ExtraBold, uppercased, tracking `0.7px`, semantic financial color (income blue, saving green, expense neutral `textSecondary`).
- **Why neutral expense color:** *Le rouge n'est pas punitif*. Even the kind tag for expense lines uses neutral ink rather than amber, because the *amount column* already carries the amber.

### Cards / Containers
- **Per-Row Card (Budget Line / Transaction Row):** `surfaceContainerLowest` background, `cornerRadius.xl` (32pt), `Shadow.subtle`. `padding.md` vertical, `padding.xs` leading (PointCircle), `padding.md` trailing. Pointed (checked) state dims to `0.62` opacity with strikethrough. Tap on circle toggles pointed; tap on row opens the detail sheet.
- **Hero Card (Budget Detail):** **Flat** — no surface, no border, no shadow. Sits flush on `appBackground`. Content: eyebrow (`DISPONIBLE · CHF`), hero amount (Manrope 72pt black on neutral), inline progress bar + percent, horizontal scroll of stat pills.
- **Hero Card (Dashboard / Previous Budget):** Gradient background keyed to financial state (Comfortable / Tight / Deficit), `cornerRadius.xl` (32pt), `Shadow.elevated`. Used only on the dashboard and the previous-budget sheet.

### Inputs
- **Form Text Field (`FormTextField`):** `Color.inputBackgroundSoft` fill, `cornerRadius.md` (24pt), `padding.lg` (16pt all around). Optional label above (`labelMedium`, `onSurfaceVariant`). Tapping anywhere on the padded background focuses the field via `.contentShape(.interaction, Rectangle())` + `onTapGesture`.
- **Hero Amount Field (`HeroAmountField`):** Custom amount input with display amount logic.

### Sheets
- **Sheet Form Container (`SheetFormContainer`):** `NavigationStack > ScrollView > VStack`. Inline navigation title, leading close button (`SheetCloseButton`), `sheetBackground` background, `padding.xl` horizontal + `padding.lg` top + `padding.xl` bottom. Auto-focuses the first field after 200ms. Always declared with `.standardSheetPresentation()`.
- **Detents:** Default `[.large]`; explicit `[.medium, .large]` only when partial-detent Liquid Glass is desired.

### Navigation
- **NavigationStack (typed destinations):** `NavigationStack(path: $path)` with feature-scoped `enum Destination: Hashable`. Never `NavigationView` (deprecated). Never `NavigationLink` without typed destination.
- **Tab Bar (`CustomTabBar`):** Floating capsule, 62pt height, Liquid Glass background. Auto-hides on focus pages.
- **Sheet Forms vs Push:** Sheets for modal forms and detail edits. Push for hierarchical content (budget → budget detail → line detail). `.fullScreenCover` for immersive flows (auth, onboarding).

### iOS-Specific Named Rules

**The No Magic Values Rule.** Every visual value flows through `DesignTokens.*` (spacing, corner radius, opacity, animation, border width, frame heights, icon sizes, chip metrics) or `Color.*` from `Color+Pulpe`. Raw `#000`, raw `Color.white`, raw padding `16`, raw radius `12`, raw `lineWidth: 2` are all **prohibited**. If no token matches, add a named token to `DesignTokens` first, then use it.

**The Tap Target Rule (iOS).** Every interactive element has a 44×44pt minimum hit area (Apple HIG). The `frame(minHeight: 44)` goes on the **Button**, never inside the label — putting it on the label inflates the visible background. Pair with `.contentShape(...)` so the full hit area is tappable. Icon buttons use `IconButtonStyle()` or `CircleIconButtonStyle()` which encode this.

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
- **Do** keep the emotion zone at the top (gradient, financial-state-keyed) and the content zone below (neutral warm). Transition with a soft `LinearGradient`, never a hard cut.
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
