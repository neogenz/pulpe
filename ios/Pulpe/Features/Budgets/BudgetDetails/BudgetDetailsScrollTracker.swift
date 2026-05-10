import Foundation
import SwiftUI

/// Drives the sticky pager fade for `BudgetDetailsView`.
///
/// Owned as `@State` by the parent view but only **read** by the extracted
/// `BudgetDetailsStickyPagerLayer` subview. Because the parent body never reads
/// `opacity`, mutations here invalidate just the pager subtree — not the parent's
/// expensive filter pipeline (`searchFilteredSections`,
/// `combinedFilteredFreeTransactions`) which would otherwise recompute on every
/// scroll tick during the fade window.
///
/// `update(heroMinY:)` is called from an `.onGeometryChange` observer on the hero;
/// the action runs outside any view body, so writing here is safe.
@Observable @MainActor
final class BudgetDetailsScrollTracker {
    private(set) var opacity: Double = 0

    /// Pager stays hidden until the user scrolls past `deadZone`, then fades in
    /// linearly over `fadeRange` so it is fully visible long before the hero
    /// leaves the viewport. Skips no-op writes so the dead zone and the
    /// past-full-fade region don't dispatch redundant Observation notifications
    /// to the sticky pager subview.
    func update(heroMinY: CGFloat) {
        let scrolled = max(0, -heroMinY)
        let deadZone: CGFloat = DesignTokens.Spacing.xxxl         // 32pt
        let fadeRange: CGFloat = DesignTokens.Spacing.sectionGap  // 40pt
        let progress = (scrolled - deadZone) / fadeRange
        let newOpacity = Double(min(max(progress, 0), 1))
        guard newOpacity != opacity else { return }
        opacity = newOpacity
    }
}
