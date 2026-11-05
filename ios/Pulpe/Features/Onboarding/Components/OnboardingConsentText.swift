import SwiftUI

/// Implicit-consent disclosure used on auth screens (Welcome + Registration).
/// The user agrees to the ToS / Privacy Policy by continuing through the flow.
struct OnboardingConsentText: View {
    let attributed: AttributedString
    /// On the forest welcome: soft white text, white links, centered under the buttons.
    var onForest = false

    var body: some View {
        Text(attributed)
            .font(PulpeTypography.caption2)
            .foregroundStyle(onForest ? Color.heroInkSecondary : Color.textTertiary)
            .multilineTextAlignment(onForest ? .center : .leading)
            .frame(maxWidth: .infinity, alignment: onForest ? .center : .leading)
            .tint(onForest ? Color.heroInk : Color.pulpePrimary)
    }
}
