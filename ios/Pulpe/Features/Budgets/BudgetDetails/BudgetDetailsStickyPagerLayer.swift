import SwiftUI

/// Sticky horizontal month pager overlay for `BudgetDetailsView`.
///
/// Three-layer composition (Revolut-style) that gives a continuous opaque→blur→clear
/// gradient under the nav bar:
///   1. Variable-blur backdrop (chips + trailing fade) — same trailing-edge variable
///      blur Apple Music/Photos use.
///   2. Top "bridge" gradient — opaque `appBackground` at the very top fading to
///      clear over `bridgeHeight`. Hides the hard line between the opaque nav-bar
///      and the variable blur below.
///   3. Chips floated on top.
///
/// Reads opacity from `BudgetDetailsScrollTracker` so re-renders are scoped to this
/// subtree only. Hit-testing flips on past 50% opacity to avoid ghost taps near the
/// fade boundary.
struct BudgetDetailsStickyPagerLayer: View {
    let months: [BudgetSparse]
    let currentBudgetId: String
    let onSelect: (String) -> Void
    let tracker: BudgetDetailsScrollTracker

    var body: some View {
        if !months.isEmpty {
            content
                .opacity(tracker.opacity)
                .allowsHitTesting(tracker.opacity > 0.5)
        }
    }

    private var content: some View {
        let barHeight = DesignTokens.TapTarget.minimum + DesignTokens.Spacing.sm * 2
        let trailingFade = DesignTokens.Spacing.xxxl   // 32pt — tight blur tail
        let bridgeHeight = DesignTokens.Spacing.xl    // 20pt opaque→clear bridge

        return ZStack(alignment: .top) {
            ProgressiveBlurEdge(
                edge: .top,
                height: barHeight + trailingFade,
                maxBlurRadius: DesignTokens.Blur.maxRadiusStrong
            )

            LinearGradient(
                colors: [Color.appBackground, Color.appBackground.opacity(0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: bridgeHeight)
            .allowsHitTesting(false)

            BudgetMonthPagerBar(
                months: months,
                currentBudgetId: currentBudgetId,
                onSelect: onSelect
            )
            .frame(height: barHeight)
        }
    }
}
