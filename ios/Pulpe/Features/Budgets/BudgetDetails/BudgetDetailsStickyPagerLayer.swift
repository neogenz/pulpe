import SwiftUI

/// Sticky month pager for `BudgetDetailsView`: once the hero has scrolled away, the forest
/// stays as the chrome. The bar paints `heroSurface` from the top of the screen (under the
/// navigation bar, whose light ink and discs keep their contrast) down to a hairline, and
/// the ledger scrolls under it — never through a blur band where a section header could
/// be half-read.
///
/// Reads opacity from `BudgetDetailsScrollTracker` so re-renders are scoped to this
/// subtree only. Hit-testing flips on past 50% opacity to avoid ghost taps near the
/// reveal boundary. The reveal is a micro fade: in faster than a glance, out faster still.
struct BudgetDetailsStickyPagerLayer: View {
    let months: [BudgetSparse]
    let currentBudgetId: String
    let onSelect: (String) -> Void
    let tracker: BudgetDetailsScrollTracker

    var body: some View {
        if !months.isEmpty {
            BudgetMonthPagerBar(
                months: months,
                currentBudgetId: currentBudgetId,
                onSelect: onSelect
            )
            .frame(height: DesignTokens.TapTarget.minimum + DesignTokens.Spacing.sm * 2)
            .background {
                Color.heroSurface
                    .ignoresSafeArea(edges: .top)
                    // The zone boundary, cast downward: here the forest sits over the ledger.
                    .shadow(
                        color: DesignTokens.Shadow.zoneBoundary.color,
                        radius: DesignTokens.Shadow.zoneBoundary.radius,
                        y: -DesignTokens.Shadow.zoneBoundary.y
                    )
            }
            // The overlay sits in the safe area, so its top edge is the bar's bottom.
            .onGeometryChange(
                for: CGFloat.self,
                of: { $0.frame(in: .global).minY },
                action: { minY in tracker.update(navBottom: minY) }
            )
            .opacity(tracker.opacity)
            .allowsHitTesting(tracker.opacity > 0.5)
            .animation(
                .easeOut(duration: tracker.opacity > 0
                    ? DesignTokens.Animation.microFadeIn
                    : DesignTokens.Animation.microFadeOut),
                value: tracker.opacity
            )
        }
    }
}
