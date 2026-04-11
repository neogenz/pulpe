import SwiftUI

/// Segmented progress indicator for onboarding steps
struct OnboardingProgressIndicator: View {
    let currentStep: OnboardingStep
    let totalSteps: Int

    private var stepIndex: Int {
        OnboardingStep.allCases.firstIndex(of: currentStep) ?? 0
    }

    private var displayStepCount: Int { totalSteps - 1 }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            HStack(spacing: DesignTokens.Spacing.xs) {
                ForEach(1..<totalSteps, id: \.self) { index in
                    Capsule()
                        .fill(index <= stepIndex ? Color.pulpePrimary : Color.secondary.opacity(0.15))
                        .frame(height: DesignTokens.Spacing.xs)
                }
            }

            Text("\(stepIndex) / \(displayStepCount)")
                .font(PulpeTypography.caption2)
                .foregroundStyle(Color.textTertiaryOnboarding)
                .monospacedDigit()
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.top, DesignTokens.Spacing.md)
        .animation(PulpeAnimations.defaultSpring, value: stepIndex)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Étape \(stepIndex) sur \(displayStepCount)")
        .accessibilityValue("\(stepIndex) sur \(displayStepCount)")
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingProgressIndicator(currentStep: .firstName, totalSteps: 7)
        OnboardingProgressIndicator(currentStep: .charges, totalSteps: 7)
        OnboardingProgressIndicator(currentStep: .registration, totalSteps: 7)
    }
    .padding()
}
