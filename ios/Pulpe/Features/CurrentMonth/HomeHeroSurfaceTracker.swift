import Foundation
import SwiftUI

/// Drives the mint surface height for `CurrentMonthView`.
///
/// Owned as `@State` by the parent view but only **read** by the extracted
/// `HomeHeroSurfaceBackground`. Because the parent body never reads `height`,
/// mutations here invalidate just the mint layer — not the hero chart, the
/// unchecked-operations deck, or the activity list, which would otherwise
/// recompute on every vertical scroll frame.
///
/// `update(_:)` is called from an `.onGeometryChange` observer on the hero
/// (loaded and skeleton). The action runs outside any view body, so writing
/// here is safe.
@Observable @MainActor
final class HomeHeroSurfaceTracker {
    private(set) var height: CGFloat = 0

    /// Publishes the hero's screen-space bottom edge. Clamps below zero so a
    /// transient negative `maxY` cannot invert the mint frame. Skips no-op
    /// writes so a stable edge (rest, or a horizontal swipe that does not
    /// move the hero) does not dispatch Observation notifications.
    func update(_ newHeight: CGFloat) {
        let clamped = max(0, newHeight)
        guard clamped != height else { return }
        height = clamped
    }
}
