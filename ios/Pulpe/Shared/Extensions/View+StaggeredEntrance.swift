import SwiftUI

// MARK: - Staggered Entrance Modifier

private struct StaggeredEntranceModifier: ViewModifier {
    let isVisible: Bool
    let index: Int
    let baseDelay: Double
    let staggerStep: Double

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(isVisible ? 1 : 0)
            .animation(
                reduceMotion
                    ? .none
                    : .easeOut(duration: DesignTokens.Animation.normal)
                        .delay(baseDelay + Double(index) * staggerStep),
                value: isVisible
            )
    }
}

extension View {
    /// Staggered entrance animation: fades in with a delay based on `index`.
    func staggeredEntrance(
        isVisible: Bool,
        index: Int,
        baseDelay: Double = 0
    ) -> some View {
        modifier(StaggeredEntranceModifier(
            isVisible: isVisible,
            index: index,
            baseDelay: baseDelay,
            staggerStep: DesignTokens.Animation.staggerStep
        ))
    }
}
