import SwiftUI

/// Centralized design tokens for visual consistency across the app
enum DesignTokens {
    // MARK: - Tap Target

    enum TapTarget {
        /// Apple HIG minimum tap target (44pt)
        static let minimum: CGFloat = 44
    }

    // MARK: - Corner Radius

    enum CornerRadius {
        /// Progress bars, thin indicators (4pt)
        static let xs: CGFloat = 4
        /// Small elements: badges, chips (8pt)
        static let sm: CGFloat = 8
        /// Progress bars with visible rounding (10pt)
        static let progressBar: CGFloat = 10
        /// Per-row inline card (18pt) — DM2.1.b.c5 budget line card
        static let card: CGFloat = 18
        /// Medium elements: inputs, cards (24pt)
        static let md: CGFloat = 24
        /// Primary buttons (14pt)
        static let button: CGFloat = 14
        /// Large elements: sheets, modals (30pt)
        static let lg: CGFloat = 30
        /// Extra large: hero cards (32pt)
        static let xl: CGFloat = 32
        /// Bottom sweep of a full-bleed zone (home hero) — reads as a sheet over the page (44pt)
        static let zone: CGFloat = 44
        /// Hairline: thin separators in Form (1pt)
        static let hairline: CGFloat = 1
    }

    // MARK: - Spacing

    enum Spacing {
        /// No spacing — used for semantic "no gap" (e.g. `HStack(spacing: .none)`)
        static let none: CGFloat = 0
        static let xxs: CGFloat = 2
        /// Tight vertical gap (3pt) — icon/label stacks in badges, tab items
        static let dividerGap: CGFloat = 3
        static let xs: CGFloat = 4
        /// Compact badge padding / inter-badge gap (6pt) — status capsules
        static let tightGap: CGFloat = 6
        static let sm: CGFloat = 8
        /// Compact horizontal gap (10pt) — tab bar segment gap
        static let compactGap: CGFloat = 10
        /// Vertical inset a plain-list section header carries by default (10pt).
        /// Reproduce it whenever `listRowInsets` is cleared to paint the header
        /// row itself, or the header shifts against the rows it introduces.
        static let listHeaderVertical: CGFloat = 10
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 20
        static let xxl: CGFloat = 24
        static let xxxl: CGFloat = 32
        /// Gap between form sections (onboarding)
        static let sectionGap: CGFloat = 40
        /// Top padding for step headers (onboarding)
        static let stepHeaderTop: CGFloat = 48
    }

    // MARK: - Tracking (Letter Spacing)

    enum Tracking {
        /// Large display numbers (year headers)
        static let display: CGFloat = -3
        /// Hero amounts (year recap big number)
        static let hero: CGFloat = -1.2
        /// Section titles
        static let title: CGFloat = -0.6
        /// Uppercase labels — narrow
        static let uppercaseNarrow: CGFloat = 0.5
        /// Uppercase labels — standard
        static let uppercase: CGFloat = 0.7
        /// Uppercase labels — wide
        static let uppercaseWide: CGFloat = 1
    }

    // MARK: - Border Width

    enum BorderWidth {
        static let hairline: CGFloat = 0.75
        static let thin: CGFloat = 1
        static let medium: CGFloat = 1.5
        static let thick: CGFloat = 2
        /// Tracked series on hero charts (`HomeHeroCard+Chart`, `GoalProjectionChart`)
        static let chartLine: CGFloat = 2
    }

    // MARK: - Shadows

    enum Shadow {
        /// Subtle shadow for flat elements
        static let subtle = ShadowStyle(
            color: .black.opacity(0.05),
            radius: 2,
            y: 1
        )
        /// Standard card shadow
        static let card = ShadowStyle(
            color: .black.opacity(0.06),
            radius: 4,
            y: 2
        )
        /// Elevated elements (hero cards, modals)
        static let elevated = ShadowStyle(
            color: .black.opacity(0.08),
            radius: 8,
            y: 4
        )
        /// Full-bleed zone boundary — the dashboard's emotion surface over the ledger.
        /// It is the only cue that the two zones sit at different depths rather than being
        /// die-cut from the same sheet, so it stays close to the edge that casts it:
        /// spread over a wide blur it dissolved into the canvas and read as nothing.
        /// Scheme-aware colour, because dark mode gets its depth from tone instead.
        /// Negative offset: the content card casts it upward onto the forest it rises over.
        static let zoneBoundary = ShadowStyle(
            color: .homeZoneBoundaryShadow,
            radius: 6,
            y: -3
        )
        /// Input fields (auth, currency)
        static let input = ShadowStyle(
            color: .black.opacity(0.04),
            radius: 6,
            y: 2
        )
        /// Toast notifications
        static let toast = ShadowStyle(
            color: .black.opacity(0.1),
            radius: 8,
            y: 4
        )
    }

    // MARK: - Opacity

    enum Opacity {
        /// Barely visible tints
        static let faint: Double = 0.04
        /// Subtle highlight backgrounds
        static let highlightBackground: Double = 0.08
        /// Toast shadow, subtle borders
        static let shadow: Double = 0.1
        /// Badge and chip backgrounds, icon backgrounds
        static let badgeBackground: Double = 0.12
        /// Sparkline fills, accent highlights
        static let accent: Double = 0.15
        /// Secondary fills, progress tracks
        static let secondary: Double = 0.2
        /// Glow effects, shadows
        static let glow: Double = 0.25
        /// Outline-pill stroke (slightly above secondary 0.2 for hairline pill borders)
        static let outlinePill: Double = 0.22
        /// Strong accents, selected states
        static let strong: Double = 0.3
        /// Onboarding progress indicator — completed-segment track fill
        static let progressTrackActive: Double = 0.32
        /// Auth field border — focused state (between disabled 0.4 and heavy 0.5)
        static let borderFocused: Double = 0.45
        /// Heavy overlays
        static let heavy: Double = 0.5
        /// Muted ink on the mint hero card — suffixes, chevrons, progress-track hairline.
        /// Floor set by WCAG 1.4.11: at `heavy` (0.5) these composite to 2.69:1 against the
        /// hero gradient's darkest light-mode stop; 0.6 lifts them to 3.42–3.57:1 light and
        /// 4.01–4.68:1 dark across both gradient stops.
        static let heroInkMuted: Double = 0.6
        /// Translucent metric tile on the forest hero surface (`Color.heroTile`)
        static let heroTile: Double = 0.12
        /// A 36pt toolbar disc on the forest: the tile tint vanishes at that size.
        static let heroDisc: Double = 0.2
        /// Area fill under the tracked series on the hero chart
        static let heroArea: Double = 0.22
        /// Disabled controls (e.g. type pills with count==0)
        static let disabled: Double = 0.4
        /// Dimmed row card — DM2.1.b.c5 pointed state on per-row card
        static let pointedDim: Double = 0.62
        /// Pressed state for interactive elements
        static let pressed: Double = 0.8
        /// Dark overlays (tutorial, modal backdrops)
        static let overlay: Double = 0.85
    }

    // MARK: - Icon Sizes

    enum IconSize {
        /// Disc behind a toolbar glyph on the hero surface (`HeroToolbarButtonStyle`).
        static let heroToolbarDisc: CGFloat = 36
        /// List row icons
        static let listRow: CGFloat = 40
        /// Compact badges
        static let badge: CGFloat = 36
        /// Small inline icons
        static let compact: CGFloat = 28
        /// Widget action button (plus circle in widget footers)
        static let widgetAction: CGFloat = 44
        /// Social login button icons (Apple logo, Google logo)
        static let socialButton: CGFloat = 20
        /// Brand logo on auth/onboarding screens
        static let brand: CGFloat = 72
        /// Hero checkmark badge on the onboarding budget preview
        static let heroBadge: CGFloat = 56
    }

    // MARK: - List Row

    enum ListRow {
        /// Vertical padding for all list/transaction/budget rows
        static let verticalPadding: CGFloat = 8
        /// Minimum row height shared across the app's list rows.
        ///
        /// Matches the natural height of `TransactionRow` (free transactions
        /// section): `IconSize.listRow` (40) + 2 × `verticalPadding` (8) = 56.
        /// Pinning budget line rows to the same minimum keeps the rhythm
        /// consistent regardless of subtitle presence.
        static let minHeight: CGFloat = IconSize.listRow + verticalPadding * 2
        /// Leading inset of the hairline between two ledger rows: past the disc and its gap,
        /// so the rule starts where the text does.
        static let dividerInset: CGFloat = TapTarget.minimum + Spacing.sm
    }

    // MARK: - Sync indicators

    /// Visibility thresholds for sync state UI (BudgetDetails feature pattern).
    enum Sync {
        /// Optimistic mutations under this delay don't surface a sync indicator
        /// — the green dot only flashes if the server round-trip exceeds the
        /// threshold, so fast updates feel instantaneous.
        static let indicatorRampDelayMs: UInt64 = 300
    }

    // MARK: - Frame Heights

    enum FrameHeight {
        /// Primary action buttons
        static let button: CGFloat = 54
        /// Progress bar track
        static let progressBar: CGFloat = 8
        /// Onboarding progress bar, a hairline under the CTA
        static let progressBarThin: CGFloat = 4
        /// Thin separator lines
        static let separator: CGFloat = 1
        /// Inline vertical divider inside a horizontally scrollable filter bar
        static let dividerInline: CGFloat = 22
    }

    // MARK: - Numpad

    enum Numpad {
        static let buttonSize: CGFloat = 75
        static let dotSize: CGFloat = 14
    }

    // MARK: - Checkbox

    enum Checkbox {
        static let size: CGFloat = 24
        /// Pulls the sync badge back in from the circle's bounding-box corner so it
        /// straddles the stroke instead of floating diagonally off it.
        static let syncBadgeInset: CGFloat = 2
    }

    // MARK: - Amount Input

    enum AmountInput {
        static let quickAmounts = [10, 15, 20, 30]
    }

    // MARK: - Blur

    enum Blur {
        /// Height of the gradient fade at the top of scrollable content
        static let topFadeHeight: CGFloat = 60
        /// Height of the gradient fade at the bottom of scrollable content
        static let bottomFadeHeight: CGFloat = 80
        /// Strong variable-blur radius for emphasized scroll-edge backdrops
        /// (e.g. sticky pager). Higher than `ProgressiveBlurEdge` default (8)
        /// so content underneath is fully obscured rather than softly blurred.
        static let maxRadiusStrong: CGFloat = 20
    }

    // MARK: - Chip Metrics

    /// Spacing tokens for `PulpeChip` (Shared/Components/PulpeChip.swift).
    /// Two sizes — `Standard` (default chips: filter pills, menu triggers) and
    /// `Prominent` (CTA chips). No `.compact` size on purpose: Pulpe DA pillar
    /// "Légèreté" forbids tight density.
    enum ChipMetrics {
        enum Standard {
            /// Horizontal padding inside the capsule
            static let horizontalPadding: CGFloat = Spacing.lg
            /// Vertical padding inside the capsule
            static let verticalPadding: CGFloat = Spacing.md
            /// Gap between elements inside the chip (icon → label → count → trailing)
            static let interElementGap: CGFloat = Spacing.tightGap
            /// Gap between adjacent chips on a rail
            static let interChipGap: CGFloat = Spacing.sm
        }

        enum Prominent {
            static let horizontalPadding: CGFloat = Spacing.xl
            static let verticalPadding: CGFloat = Spacing.lg
            static let interElementGap: CGFloat = Spacing.sm
            static let interChipGap: CGFloat = Spacing.md
        }

        /// Inner-badge (count pill) padding — shared across sizes.
        enum CountBadge {
            static let horizontalPadding: CGFloat = Spacing.tightGap
            static let verticalPadding: CGFloat = Spacing.xxs
        }

        /// Leading state-dot diameter (`PulpeChip(dotColor:)`).
        static let stateDotSize: CGFloat = Spacing.tightGap
    }

    // MARK: - Skeleton

    /// Placeholder dimensions for loading states — sized to the real content they stand in for,
    /// so the skeleton doesn't reflow when data lands.
    enum Skeleton {
        static let compactTextWidth: CGFloat = 72
        static let shortTextWidth: CGFloat = 96
        static let mediumTextWidth: CGFloat = 120
        static let longTextWidth: CGFloat = 180
        static let extraLongTextWidth: CGFloat = 240
        static let numericWidth: CGFloat = 36
        static let captionHeight: CGFloat = 12
        static let bodyHeight: CGFloat = 14
        /// Greeting line ("Bonjour, Maxime").
        static let greetingWidth = longTextWidth
        /// A single line of placeholder text.
        static let lineHeight: CGFloat = 18
        /// A `HeroMetricTile` placeholder: value + label lines plus `md` padding on each side.
        static let heroTileHeight: CGFloat = 64
        static let sectionHeight: CGFloat = 20
        static let tagHeight: CGFloat = 20
        static let chipHeight: CGFloat = 30
        static let controlHeight: CGFloat = 36
        static let amountHeight: CGFloat = 44
        static let displayHeight: CGFloat = 56
        /// Projected month-end home summary.
        static let heroHeight: CGFloat = 240
    }

    // MARK: - Text Scale

    /// Floors for `minimumScaleFactor` on text that must not wrap or truncate under
    /// Dynamic Type — amounts, units and compact controls that share a row with a sibling.
    enum TextScale {
        /// Amounts and units held to a single line (hero figure, currency suffix).
        static let floor: CGFloat = 0.6
        /// Short labels that only need to give up a little (compact toggles, chips).
        static let compact: CGFloat = 0.8
    }

    // MARK: - Progress Bar

    enum Layout {
        /// How far a scroll-native zone background is bled past its own edge, so overscroll
        /// (pull-to-refresh, rubber-banding) and the status bar never show the canvas behind
        /// it. Any value taller than a screen works; 1000pt is just comfortably past it.
        static let overscrollBleed: CGFloat = 1000
    }

    enum Motion {
        /// Fraction of the scroll offset the home hero follows, so the content card appears
        /// to rise over it. 0 = scrolls 1:1 with the card (what Reduce Motion gets).
        static let heroParallax: CGFloat = 0.35
    }

    enum ProgressBar {
        /// Standard thin progress bar height
        static let height: CGFloat = 5
        /// Thick progress bar height
        static let thickHeight: CGFloat = 8
        /// Circular progress stroke width
        static let circularLineWidth: CGFloat = 6
        /// Hero card progress bar height (larger for visibility on colored backgrounds)
        static let heroHeight: CGFloat = 10
        /// Flow bar height — substantial enough to act as a card headline (Entrées/Sorties)
        static let flowBarHeight: CGFloat = 14
    }
}

// MARK: - Shadow Style

struct ShadowStyle {
    let color: Color
    let radius: CGFloat
    let y: CGFloat

    var x: CGFloat { 0 }
}

// MARK: - View Modifier

extension View {
    func shadow(_ style: ShadowStyle) -> some View {
        self.shadow(color: style.color, radius: style.radius, x: style.x, y: style.y)
    }
}
