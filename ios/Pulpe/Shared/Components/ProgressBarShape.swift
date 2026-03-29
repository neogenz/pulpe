import SwiftUI

/// Animatable progress bar shape — fills proportionally from the leading edge.
/// Uses `path(in:)` to read the available rect directly (no GeometryReader or @State needed).
struct ProgressBarShape: Shape {
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    func path(in rect: CGRect) -> Path {
        let clampedProgress = min(max(progress, 0), 1)
        let fillWidth = rect.width * clampedProgress
        guard fillWidth > 0 else { return Path() }
        let cornerRadius = rect.height / 2
        return Path(
            roundedRect: CGRect(x: 0, y: 0, width: fillWidth, height: rect.height),
            cornerRadius: cornerRadius
        )
    }
}
