import Foundation
import SwiftUI

/// Drives the hero surface height for a screen on `HeroZoneSurface`.
///
/// Owned as `@State` by the parent view but only **read** by `HeroZoneSurface`.
/// Because the parent body never reads `height`, mutations here invalidate just the
/// surface layer — not the hero content or the ledger below it, which would otherwise
/// recompute on every vertical scroll frame.
///
/// `update(_:)` is called from an `.onGeometryChange` observer on the hero (loaded and
/// skeleton). The action runs outside any view body, so writing here is safe.
@Observable @MainActor
final class HeroZoneTracker {
    private(set) var height: CGFloat = 0

    /// Publishes the hero's screen-space bottom edge. Clamps below zero so a transient
    /// negative `maxY` cannot invert the surface frame. Skips no-op writes so a stable
    /// edge does not dispatch Observation notifications.
    func update(_ newHeight: CGFloat) {
        let clamped = max(0, newHeight)
        guard clamped != height else { return }
        height = clamped
    }
}
