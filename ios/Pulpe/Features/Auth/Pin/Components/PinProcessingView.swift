import SwiftUI

/// Shared processing spinner with title and subtitle.
/// Used during PIN change and PIN recovery re-encryption.
struct PinProcessingView: View {
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            ProgressView()
                .tint(Color.textPrimaryOnboarding)
                .scaleEffect(1.5)

            Text(title)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            Text(subtitle)
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(.center)
        }
        .accessibilityElement(children: .combine)
    }
}
