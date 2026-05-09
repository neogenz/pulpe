---
name: Pulpe
description: Calm naturalism for personal budgeting — warm neutrals, purposeful color, zero anxiety.
colors:
  # Brand
  pulpe-primary: "#006E25"
  pulpe-primary-on: "#FFFFFF"
  pulpe-secondary: "#406741"
  pulpe-tertiary: "#0061A6"
  # Financial semantic (light mode canonical, iOS dynamic)
  financial-income: "#0061A6"
  financial-expense: "#B35800"
  financial-savings: "#157038"
  financial-over-budget: "#A86800"
  # Surface (warm hierarchy)
  app-background: "#F7F6F3"
  sheet-background: "#F5F3F0"
  surface: "#FFFFFF"
  surface-container-low: "#FCFAF7"
  surface-container: "#F5F3F0"
  surface-container-high: "#F0EDE9"
  surface-container-highest: "#E8E5E1"
  # Text
  text-primary: "#1A1C19"
  text-secondary: "#524D48"
  text-tertiary: "#6E6762"
  # Outline
  outline: "#6F7A6D"
  outline-variant: "#BFCABA"
  # Hero gradients (mid-stop tints, used for emotion zone)
  hero-comfortable: "#14AD45"
  hero-tight: "#D88010"
  hero-deficit: "#C45028"
  # Destructive (irreversible only — delete account, danger zones)
  destructive: "#C62828"
typography:
  display:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-3px"
  headline:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.6px"
  amount-hero:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-1.2px"
  amount-card:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "20px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, SF Pro, BlinkMacSystemFont, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, SF Pro, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  list-row-title:
    fontFamily: "-apple-system, SF Pro, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  metric-label:
    fontFamily: "-apple-system, SF Pro, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  kind-tag:
    fontFamily: "Manrope, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "10px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "0.7px"
  label-medium:
    fontFamily: "-apple-system, SF Pro, BlinkMacSystemFont, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "normal"
  button:
    fontFamily: "-apple-system, SF Pro, BlinkMacSystemFont, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
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

# Design System: Pulpe

## 1. Overview: The Warm Naturalist

**Creative North Star: "Un grand bol d'air frais après avoir fermé Excel."**

Pulpe is calm naturalism for personal budgeting. The interface is the visceral shift from *subir* to *maîtriser* — fog lifts, cognitive load drops, the user breathes. Every surface is a warm neutral (`#F7F6F3`), every accent is a deliberate financial signal, every motion is a soft spring (no bounce, no elastic, no anxiety). The primary green is a brand color, not a celebration; red is reserved for one rare context where it earns its keep.

The system is split into two zones. The **emotion zone** at the top of dashboards and budget headers carries feeling — colored gradients keyed to the user's financial state. The **content zone** below is neutral warm and ruthlessly readable. Character lives at the top; clarity lives below. This is non-negotiable.

This system explicitly rejects: cold corporate banking apps with navy and aggressive charts; anxious finance apps that drench the UI in red; dense accounting software that intimidates with jargon-heavy chrome; Revolut's crunchy gradients on content cards (we keep gradients in the hero and nowhere else); generic AI-tool sterile minimalism. Pulpe is warm. Pulpe is grounded. Pulpe is a companion, not a coach.

**Key Characteristics:**
- Warm neutral surface (`#F7F6F3`), never cold gray, never green-tinted
- Two-zone layout — emotion at the top, information below, soft 40–60px gradient transition
- Color carries meaning: green = savings/positive, amber = expense, blue = income, red = global deficit only
- Soft springs (response 0.4–0.6s, damping 0.65–0.85), zero bounce
- Manrope (display + amounts) + system body font (SF Pro on iOS, DM Sans on web). Two families, max
- Apple HIG 44pt tap targets, AA contrast, `prefers-reduced-motion` respected
- Liquid Glass on navigation only — never on content

## 2. Colors: The Warm Naturalist Palette

A neutral warm canvas with three semantic accents, one cautionary amber, and one rare red. No decorative color, anywhere. Misusing color is lying.

### Primary
- **Pulpe Forest** (`#006E25`, dark forest green): The brand color. Used for the primary CTA capsule, the savings amount, the savings progress bar fill, and brand glyphs. Carries `Soulagement`. Dark mode flips to lime (`#7EDB83`) for AAA contrast on near-black.

### Secondary
- **Sage** (`#406741`, muted secondary green): Discrete labels, secondary container fills, the secondary container chip background. Never a CTA fill — it stays on the periphery.

### Tertiary
- **Lake** (`#0061A6`, calm corporate blue): Income amounts, info chips, links, edit actions. The "neutral information" hue. Never used for warnings. Dark mode shifts to `#5AA8E0`.

### Financial Accents (semantic, not decorative)
- **Income / Lake** (`#0061A6`): All income amounts, income pill, income kind tag. Same hue as Tertiary.
- **Savings / Forest Bright** (`#157038`): All savings amounts, savings pill, savings kind tag. A slightly brighter green than Pulpe Forest, tuned for ink contrast on warm surfaces.
- **Expense / Amber** (`#B35800`): All expense amounts, expense pill, expense kind tag, moderate over-budget warnings. Warm amber, never red.
- **Over-Budget / Burnt Amber** (`#A86800`): Envelopes that have actually overrun. Still amber — the overshoot is *factual*, not punitive.
- **Hero Deficit / Sunset Coral** (`#C45028`, gradient mid-stop): The single legitimate red-adjacent surface. Reserved for the hero card when total spending exceeds available (>100%). Never appears on a content row, transaction, or label.

### Neutral (Warm Hierarchy)
- **App Background** (`#F7F6F3`): The neutral warm canvas. Every screen sits on this. Dark mode is `#141210` — warm near-black, not pure `#000`.
- **Sheet Background** (`#F5F3F0`): Sheets sit slightly cooler-warm than the app, providing contrast against cards in dark mode.
- **Surface / Card** (`#FFFFFF` light, `#1A1816` dark): Row cards, hero cards, list rows.
- **Surface Container Low / High / Highest** (`#FCFAF7` → `#E8E5E1`): Tonal layering. Low for resting cards, high for elevated chips, highest for pressed chip backgrounds.
- **Text Primary** (`#1A1C19`): Body text. Never pure `#000` — that's iOS 2014.
- **Text Secondary** (`#524D48`): Subtitles, captions. WCAG AAA on warm surfaces.
- **Text Tertiary** (`#6E6762`): Hints, footers, decorative metadata.
- **Outline / Variant** (`#6F7A6D` / `#BFCABA`): Hairline borders, dividers, dashed pill borders.

### Destructive (Irreversible Only)
- **True Red** (`#C62828`): Account deletion, danger zone confirmations. *Never* used for over-budget feedback. The point of `DestructiveButtonStyle` is that you only see it when something cannot be undone.

### Named Rules

**The Two-Zone Rule.** Every screen with a hero is split. Top 30–35% is the **emotion zone** — gradient-filled, financial-state-keyed (Comfortable green / Tight amber / Deficit coral). Below is the **content zone** — neutral warm `#F7F6F3`, lists and cards on top. Transition is a soft gradient (40–60px), never a hard cut. Screens without a hero (templates, settings) skip the emotion zone entirely; the warm canvas fills full screen.

**The Color Means Something Rule.** Every hue maps to a financial concept or a state. Green = positive / savings / actions. Blue = income / information / links. Amber = expense / moderate warning / over-budget. Red = hero deficit only. There is no decorative color in Pulpe. If a color doesn't map to a meaning, it doesn't ship.

**The Anxiety Red Rule.** Red is forbidden everywhere except the hero card when financial state is Deficit (>100% of available spent). Lines, rows, transactions, pills, and labels for expenses use **amber**, never red. *Le rouge n'est pas punitif* — quoting our own design doctrine.

## 3. Typography

**Display Font:** Manrope (with `-apple-system` fallback) — bold and extrabold weights only.
**Body / UI Font:** SF Pro (iOS system) on iOS, DM Sans on web, Poppins on the landing page.
**Numbers:** SF Pro Tabular Digits everywhere amounts appear. `monospacedDigit()` is mandatory on every `Text` rendering a Decimal.

**Character:** Manrope is friendly-modern with a bit of warmth in its terminals — it carries the brand without being decorative. The system body font carries clarity and accessibility (Dynamic Type respected). Two families, never three. No serifs. No geometric tech fonts (Inter, Roboto). No mono fonts in chrome (mono is reserved for recovery keys and codes).

### Hierarchy

- **Display** (Manrope ExtraBold, 72pt, lh 1.0, tracking `-3px`): Year recap big number on the budget list. The biggest number on the screen is the number that defines the year.
- **Headline** (Manrope Bold, 34pt, lh 1.05, tracking `-0.6px`): Hero amount on the dashboard, brand titles. Sole headline on a screen.
- **Amount Hero** (Manrope ExtraBold, 34pt, lh 1.0, tracking `-1.2px`): The hero balance amount on `BudgetDetailsView`. Black on neutral, never colored.
- **Amount Card** (Manrope ExtraBold, 20pt): Per-row card amounts. Tabular figures.
- **Title** (SF Pro Semibold, 22pt): Section titles, sheet titles.
- **Body** (SF Pro, 17pt): Default content, descriptions, list row titles in semibold.
- **List Row Title** (SF Pro Semibold, 17pt): Budget line names, transaction descriptions.
- **Metric Label** (SF Pro Bold, 13pt): Pill text, chip labels, count badges.
- **Kind Tag** (Manrope ExtraBold, 10pt, tracking `0.7px`, uppercased): Inline `REVENU` / `ÉPARGNE` / `DÉPENSE` tags above row labels. The word carries meaning; the color reinforces.
- **Label Medium** (SF Pro Medium, 13pt): Form field labels, secondary metadata.
- **Button** (SF Pro Semibold, 17pt): All primary, secondary, and destructive button text.

### Named Rules

**The Tutoiement Rule.** Always "tu", never "vous". This is brand voice, not preference. Errors explain what happened and suggest a next step — never blame the user. Empty states guide. Microcopy disarms anxiety: *"Ça arrive"*, *"Tu le sais, et c'est déjà ça."*

**The Tabular Digits Rule.** Every numeric amount uses `monospacedDigit()` (iOS) / `tabular-nums` (web). Digits don't wobble between updates. Non-negotiable on hero amounts, row amounts, pill counts.

**The Two-Decimals Rule (iOS Budget Detail page).** On the iOS Budget Detail page, all currency amounts render with two decimals (`1'234.56 CHF`). `asCompactCurrency` (the rounded compact format) is **prohibited** in this context. Other surfaces apply the dual aggregation/ligne policy from the project's currency-formatting rule.

## 4. Elevation

Pulpe is **flat by default with restrained tonal layering**. Shadows exist but they are diffuse and warm-tinted; they never define structure, only state. Depth comes from surface tone (`surfaceContainerLow` → `surfaceContainerHighest`), not from cast shadows. The hero card is gradient-filled; everything else is flat surface or hairline-bordered.

### Shadow Vocabulary

- **Subtle** (`0 1px 2px rgba(0,0,0,0.05)`): Per-row card lift on the Budget Detail page. The faintest possible separation.
- **Card** (`0 2px 4px rgba(0,0,0,0.06)`): Default card lift. Used sparingly.
- **Elevated** (`0 4px 8px rgba(0,0,0,0.08)`): Hero cards, modals, dialog surfaces.
- **Input** (`0 2px 6px rgba(0,0,0,0.04)`): Auth and currency input field rest state.
- **Toast** (`0 4px 8px rgba(0,0,0,0.10)`): Toast notifications (transient, top-of-stack only).

### Named Rules

**The Glass Restraint Rule.** iOS 26 Liquid Glass appears on **navigation only** — toolbars, tab bars, floating buttons, sheets with partial detents. *Never* on content cards, list rows, or text. The system handles this for standard navigation components; custom views must `.glassEffect()` only on navigation chrome. Pre-auth flows (welcome, login, onboarding) may use glow / shadow for brand expressivity; the authenticated app stays restrained.

**The Sheet Background Rule.** Every sheet must declare `.standardSheetPresentation()` (which bundles `.presentationBackground(Color.sheetBackground)` + detents + drag indicator + corner radius). iOS 26's Liquid Glass bleeds through any sheet without an explicit presentation background. No exceptions. Custom-background sheets (gradient sheets like RecoveryKey) declare `.presentationBackground { ... }` explicitly.

## 5. Components

### Buttons

- **Shape:** Capsule (`pill` rounded, `9999px`). The capsule is the brand button.
- **Primary:** `Color.onboardingGradient` (forest → mint, leading→trailing) for enabled, `primaryContainerDisabled` (warm tinted) for disabled. White text. Full-width, 54pt height. Used for the single dominant CTA per screen.
- **Secondary:** Transparent fill, hairline `outlineVariant` border, primary text color. Same dimensions as Primary. Cancel, back, alternative actions.
- **Destructive:** Solid `Color.destructivePrimary` (`#C62828`) fill, white text. Same dimensions. *Only* for irreversible actions (account deletion, danger zones).
- **Icon (`IconButtonStyle`):** Transparent, 44×44pt minimum hit area, content shape `Rectangle()`. Eye toggle, dismiss X, delete, chart.
- **Icon Circle (`CircleIconButtonStyle`):** Same as Icon but `contentShape(Circle())`. The chart button on the hero card.
- **Text Link (`TextLinkButtonStyle`):** Pressed-feedback only, no forced height. Container spacing provides the tap target. Forgot-password, see-all, back-to-list.
- **Plain Pressed (`PlainPressedButtonStyle`):** Pressed feedback only. For chips and custom layouts that manage their own shape.
- **Pressed state:** opacity drops to `0.8` (`DesignTokens.Opacity.pressed`), eased over 0.2s.

### Chips & Pills

The Budget Detail filter rail uses **selected/unselected pill chips** and a **leading menu chip** that opens a native iOS Menu. The hero card uses **stat pills** with tinted backgrounds keyed to the financial category.

- **Filter Pill (selected):** `Color.textPrimary` fill, `Color(.systemBackground)` text, count badge in `Color(.systemBackground).opacity(0.2)` capsule. The selected state is the dark inverse — high contrast, unambiguous selection signal.
- **Filter Pill (unselected):** `Color.surface` fill, `outline` hairline border (`Color.onSurfaceVariant.opacity(0.22)`), primary text. Disabled pills (count = 0, except `.all`) drop to `0.4` opacity.
- **Filter Menu Chip:** Same shape as Filter Pill (unselected). HStack of `[icon, label, count badge, chevron.down]`. Tap opens an iOS native menu with the three État options + counts.
- **Stat Pill (hero):** Capsule with `tint.opacity(0.15)` background (income/savings/expense). Tinted ink on tinted fill — the colored pill is the same color as the digit. `tightGap` between icon, amount, and category label.
- **Rollover Pill:** `surfaceContainer` fill with a **dashed** `outlineVariant` hairline border. Indicates the previous month's carryover; the dash signals impermanence vs the solid stat pills.

### Kind Tag (Inline Label)

- **Style:** 10pt Manrope ExtraBold, uppercased, tracking `0.7px`, semantic financial color (income blue, saving green, expense neutral `textSecondary`).
- **Why neutral expense color:** *Le rouge n'est pas punitif*. Even the kind tag for expense lines uses neutral ink rather than amber, because the *amount column* already carries the amber.

### Cards / Containers

- **Per-Row Card (Budget Line / Transaction Row):** `surfaceContainerLowest` background, `cornerRadius.xl` (32pt), `Shadow.subtle`. `padding.md` vertical, `padding.xs` leading (where the PointCircle sits), `padding.md` trailing. Pointed (checked) state dims the card to `0.62` opacity with strikethrough on the title. Tap on the circle toggles pointed; tap on the row opens the detail sheet.
- **Hero Card (Budget Detail):** **Flat layout, no surface, no border, no shadow.** Sits flush on `appBackground`. Content: eyebrow (`DISPONIBLE · CHF`), hero amount (Manrope 72pt black on neutral), inline progress bar + percent, horizontal scroll of stat pills.
- **Hero Card (Dashboard / Previous Budget):** Gradient background keyed to financial state (Comfortable / Tight / Deficit), `cornerRadius.xl` (32pt), `Shadow.elevated`. Used only on the dashboard and the previous-budget sheet.

### Inputs

- **Form Text Field:** `Color.inputBackgroundSoft` fill, `cornerRadius.md` (24pt), `padding.lg` (16pt all around). Optional label above (`labelMedium`, `onSurfaceVariant`). Focused state via system focus; tapping anywhere on the padded background focuses the field via `.contentShape(.interaction, Rectangle())` + `onTapGesture`.
- **Hero Amount Field:** Custom amount input with display amount logic; lives in `Shared/Components/HeroAmountField.swift`.

### Sheets

- **Sheet Form Container:** `NavigationStack > ScrollView > VStack`. Inline navigation title, leading close button (`SheetCloseButton`), `sheetBackground` background, `padding.xl` horizontal + `padding.lg` top + `padding.xl` bottom. Auto-focuses the first field after 200ms. Always declared with `.standardSheetPresentation()`.
- **Detents:** Default `[.large]`; explicit `[.medium, .large]` only when partial-detent Liquid Glass is desired.

### Navigation

- **NavigationStack (typed destinations):** `NavigationStack(path: $path)` with feature-scoped `enum Destination: Hashable`. Never `NavigationView` (deprecated). Never `NavigationLink` without typed destination.
- **Tab Bar (`CustomTabBar`):** Floating capsule, 62pt height, Liquid Glass background. Auto-hides on focus pages.
- **Sheet Forms vs Push:** Sheets for modal forms and detail edits. Push for hierarchical content (budget → budget detail → line detail). `.fullScreenCover` for immersive flows (auth, onboarding).

### Named Rules

**The No Magic Values Rule.** Every visual value flows through `DesignTokens.*` (spacing, corner radius, opacity, animation, border width, frame heights, icon sizes) or `Color.*` from `Color+Pulpe`. Raw `#000`, raw `Color.white`, raw padding `16`, raw radius `12`, raw `lineWidth: 2` are all **prohibited**. If no token matches, add a named token to `DesignTokens` first, then use it.

**The Tap Target Rule.** Every interactive element has a 44×44pt minimum hit area (Apple HIG). The `frame(minHeight: 44)` goes on the **Button**, never inside the label — putting it on the label inflates the visible background. Pair with `.contentShape(...)` so the full hit area is tappable. Icon buttons use `IconButtonStyle()` or `CircleIconButtonStyle()` which encode this.

**The Chip Composition Rule (PulpeChip atom — forthcoming).** Chips and pills are **never** composed ad-hoc from `Capsule().fill(...)` + padding + text in feature code. They go through a shared `PulpeChip` atom in `Shared/Components/`. The current `BudgetTypeFilter` is the migration target — until the atom lands, new chips reuse `BudgetTypeFilter`'s pill builders rather than re-rolling the same Capsule + padding + border combinator.

### Web & Landing Notes

- **Webapp (Angular):** Three token layers — `--mat-sys-*` (Material foundation, theme only), Tailwind utilities (`text-primary`, `bg-surface`), and `--pulpe-*` (semantic — `--pulpe-financial-income`, `--pulpe-page-gutter-mobile`, etc.). Material components are overridden via `mat.*-overrides()` mixins in global SCSS, **never** `::ng-deep`. Neutral seed `#8A8A82` is used to generate the warm Material neutral palette. Buttons use `matButton="filled"` / `matButton="outlined"` (Material 21 unified directive).
- **Landing (Next.js + Tailwind v4):** Poppins-only font stack. Background `#F6FFF0` (slightly cooler than the app's warm canvas — landing is brighter, more breathing room). Brand-tinted shadows (`rgba(0, 60, 20, 0.06)`) instead of generic black-on-low-opacity. `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` for a slight lift on interactive elements (the only place mild bounce is permitted — landing only, never the app).

## 6. Do's and Don'ts

### Do:

- **Do** route every visual value through `DesignTokens.Spacing/CornerRadius/Opacity/Animation/BorderWidth/FrameHeight/IconSize` or `Color+Pulpe` semantic colors.
- **Do** apply `.standardSheetPresentation()` on every sheet — without it, iOS 26 Liquid Glass bleeds through.
- **Do** put `frame(minHeight: 44)` on the **Button** (not the label) and pair with `.contentShape()`.
- **Do** use `Color.financialIncome` / `Color.financialSavings` / `Color.financialExpense` for category accents, and `Color.financialOverBudget` for envelopes that have actually overrun.
- **Do** use `PrimaryButtonStyle` / `SecondaryButtonStyle` / `DestructiveButtonStyle` / `IconButtonStyle` / `TextLinkButtonStyle` / `PlainPressedButtonStyle` / `CircleIconButtonStyle` — never hand-roll a button.
- **Do** use Manrope for display, brand titles, and amount text. Use system body font (SF Pro / DM Sans) for everything else.
- **Do** use `monospacedDigit()` on every `Text` rendering a Decimal.
- **Do** keep the emotion zone at the top (gradient, financial-state-keyed) and the content zone below (neutral warm). Transition with a soft gradient, never a hard cut.
- **Do** address the user with "tu", always. Microcopy disarms anxiety.
- **Do** use Manrope ExtraBold for the hero amount on the Budget Detail page, rendered in `Color.textPrimary` (black on neutral) — the hero is flat, not colored.

### Don't:

- **Don't** use Revolut's crunchy gradients on content cards. Gradients live in the hero zone and nowhere else.
- **Don't** ship cold banking apps with navy + aggressive charts.
- **Don't** use anxiety red anywhere except the hero deficit (>100% spent). Lines, rows, transactions, pills, kind tags for expenses use **amber**, never red.
- **Don't** use dense accounting jargon-heavy chrome — Pulpe is for tired humans, not finance nerds.
- **Don't** use display fonts (Manrope, Poppins) in UI labels, captions, or buttons — body fonts (SF Pro, DM Sans) only for chrome.
- **Don't** use raw `Color.white` or `#000` — use `Color(.systemBackground)` and `Color.textPrimary`. Pure black is iOS 2014.
- **Don't** write side-stripe borders (a >1px colored accent strip on the left or right edge of a card). Pulpe uses **full borders** + tints, never decorative side stripes.
- **Don't** apply Liquid Glass (`.glassEffect()`) to content cards, list rows, or text. Glass is for navigation chrome only.
- **Don't** compose chips or pills from raw `Capsule().fill(...)` + padding ad-hoc — go through `BudgetTypeFilter`'s pill patterns today, the forthcoming `PulpeChip` atom tomorrow.
- **Don't** write magic numeric values for visual properties. `.padding(16)`, `.cornerRadius(12)`, `.opacity(0.5)`, `lineWidth: 2`, `.easeInOut(duration: 0.3)` — all forbidden. Use the token.
- **Don't** put `frame(minHeight: 44)` inside a Button's label — it inflates the visible background to 44pt. The hitbox goes on the Button, the visual stays compact.
- **Don't** ship a sheet without an explicit `.presentationBackground(...)` — iOS 26 will bleed glass through it.
- **Don't** use `::ng-deep` in Angular components. Material overrides go through `mat.*-overrides()` mixins in global SCSS.
- **Don't** mix three font families on any single platform. Two max — display + body.
