import SwiftUI

extension View {
    /// Staggered blur-slide entrance effect inspired by Apple's onboarding.
    /// Compositing group ensures blur applies to the grouped view, not individual nodes.
    func blurSlide(_ show: Bool) -> some View {
        self
            .compositingGroup()
            .blur(radius: show ? 0 : 10)
            .opacity(show ? 1 : 0)
            .offset(y: show ? 0 : 40)
    }
}

/// Runs a delayed animation — useful for staggering entrance sequences.
@MainActor
func delayedAnimation(_ delay: Double, animation: Animation = .smooth, action: @escaping () -> Void) async {
    try? await Task.sleep(for: .seconds(delay))
    guard !Task.isCancelled else { return }
    withAnimation(animation) {
        action()
    }
}
