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

    private var currentIndex: Int {
        progressSteps.firstIndex(of: currentStep) ?? 0
    }

    private var totalCount: Int { progressSteps.count }

    var body: some View {
        VStack(alignment: .center, spacing: DesignTokens.Spacing.xs) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                ForEach(0..<totalCount, id: \.self) { index in
                    Capsule()
                        .fill(segmentFill(for: index))
                        .frame(maxWidth: .infinity)
                        .frame(height: segmentHeight(for: index))
                }
            }

            Text("\(currentPosition) / \(totalCount)")
                .font(PulpeTypography.caption2)
                .foregroundStyle(Color.textTertiaryOnboarding)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.md)
        .animation(PulpeAnimations.defaultSpring, value: currentIndex)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Étape \(currentPosition) sur \(totalCount), étape actuelle : \(currentStep.title)")
        .accessibilityValue("\(currentPosition) sur \(totalCount)")
    }

    private func segmentFill(for index: Int) -> Color {
        if index < currentIndex {
            Color.pulpePrimary.opacity(0.32)
        } else if index == currentIndex {
            Color.pulpePrimary
        } else {
            Color.secondary.opacity(0.12)
        }
    }

    private func segmentHeight(for index: Int) -> CGFloat {
        index == currentIndex ? DesignTokens.Spacing.sm : DesignTokens.Spacing.xs
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
