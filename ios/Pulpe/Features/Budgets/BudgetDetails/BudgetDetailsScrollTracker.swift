import Foundation
import SwiftUI

/// Drives the sticky pager reveal for `BudgetDetailsView`.
///
/// Owned as `@State` by the parent view but only **read** by the extracted
/// `BudgetDetailsStickyPagerLayer` subview. Because the parent body never reads
/// `opacity`, mutations here invalidate just the pager subtree — not the parent's
/// expensive filter pipeline (`searchFilteredSections`,
/// `combinedFilteredFreeTransactions`) which would otherwise recompute on every
/// scroll tick during the fade window.
///
/// Fed by two `.onGeometryChange` observers in screen space: the hero's bottom edge and
/// the pager's own top edge (which is the navigation bar's bottom, as the overlay sits
/// in the safe area). The actions run outside any view body, so writing here is safe.
@Observable @MainActor
final class BudgetDetailsScrollTracker {
    private(set) var opacity: Double = 0
    @ObservationIgnored private var heroMaxY: CGFloat = .infinity
    @ObservationIgnored private var navBottom: CGFloat = 0

    func update(heroMaxY: CGFloat) {
        self.heroMaxY = heroMaxY
        recompute()
    }

    func update(navBottom: CGFloat) {
        self.navBottom = navBottom
        recompute()
    }

    /// The pager appears only once the hero has left: hidden while the hero's bottom
    /// edge is below the navigation bar, fully visible once it has passed it by
    /// `revealRange`. Keyed on the hero's edge rather than on a scroll distance so the
    /// bar never covers hero content, whatever the hero's height.
    private func recompute() {
        let revealRange: CGFloat = DesignTokens.Spacing.xxl  // 24pt
        let progress = (navBottom - heroMaxY) / revealRange
        let newOpacity = Double(min(max(progress, 0), 1))
        guard newOpacity != opacity else { return }
        opacity = newOpacity
    }
}
