import SwiftUI

/// Implicit-consent disclosure used on auth screens (Welcome + Registration).
/// The user agrees to the ToS / Privacy Policy by continuing through the flow.
struct OnboardingConsentText: View {
    let attributed: AttributedString

    var body: some View {
        Text(attributed)
            .font(PulpeTypography.caption2)
            .foregroundStyle(Color.textTertiaryOnboarding)
            .multilineTextAlignment(.center)
            .tint(Color.pulpePrimary)
    }
}
