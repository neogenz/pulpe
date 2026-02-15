import SwiftUI

/// Segmented progress indicator for onboarding steps
struct OnboardingProgressIndicator: View {
    let currentStep: OnboardingStep
    let totalSteps: Int

    private var stepIndex: Int {
        OnboardingStep.allCases.firstIndex(of: currentStep) ?? 0
    }

    var body: some View {
        HStack(spacing: 4) {
            ForEach(1..<totalSteps, id: \.self) { index in
                Capsule()
                    .fill(index <= stepIndex ? Color.pulpePrimary : Color.secondary.opacity(0.2))
                    .frame(height: 4)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .animation(PulpeAnimations.defaultSpring, value: stepIndex)
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingProgressIndicator(currentStep: .personalInfo, totalSteps: 5)
        OnboardingProgressIndicator(currentStep: .expenses, totalSteps: 5)
        OnboardingProgressIndicator(currentStep: .registration, totalSteps: 5)
    }
    .padding()
}
