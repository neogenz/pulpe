import SwiftUI

/// Segmented progress indicator for onboarding steps.
/// Takes the actual visible steps so the count reflects what the user sees
/// (e.g. social users with a provider name don't see firstName or registration).
struct OnboardingProgressIndicator: View {
    let currentStep: OnboardingStep
    let progressSteps: [OnboardingStep]

    private var currentPosition: Int {
        progressSteps.firstIndex(of: currentStep).map { $0 + 1 } ?? 0
    }

    private var totalCount: Int { progressSteps.count }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                ForEach(0..<totalCount, id: \.self) { index in
                    Capsule()
                        .fill(index < currentPosition ? Color.pulpePrimary : Color.secondary.opacity(0.15))
                        .frame(maxWidth: .infinity)
                        .frame(height: DesignTokens.Spacing.xs)
                }
            }

            Text("\(currentPosition) / \(totalCount)")
                .font(PulpeTypography.caption2)
                .foregroundStyle(Color.textTertiaryOnboarding)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.md)
        .animation(PulpeAnimations.defaultSpring, value: currentPosition)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Étape \(currentPosition) sur \(totalCount)")
        .accessibilityValue("\(currentPosition) sur \(totalCount)")
    }
}

#Preview {
    VStack(spacing: 40) {
        // Email user — sees all 6 steps
        OnboardingProgressIndicator(
            currentStep: .firstName,
            progressSteps: [.firstName, .registration, .income, .charges, .savings, .budgetPreview]
        )
        // Social user with name — skips firstName + registration → 4 steps
        OnboardingProgressIndicator(
            currentStep: .income,
            progressSteps: [.income, .charges, .savings, .budgetPreview]
        )
    }
    .padding()
}
