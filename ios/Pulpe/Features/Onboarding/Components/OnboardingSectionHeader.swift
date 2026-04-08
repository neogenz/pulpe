import SwiftUI

/// Reusable section header + content wrapper for onboarding steps.
/// Used by ChargesStep, SavingsStep, and IncomeStep.
struct OnboardingSectionHeader<Content: View>: View {
    let title: String
    let icon: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: icon)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.onboardingSectionIcon)
                Text(title)
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
            }

            content()
        }
    }
}
