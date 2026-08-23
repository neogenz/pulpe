import SwiftUI

/// Thin progress bar of the onboarding, rendered in the bottom zone under the CTA.
/// Takes the actual visible steps so the count reflects what the user sees
/// (e.g. social users with a provider name don't see firstName or registration).
struct OnboardingProgressIndicator: View {
    let currentStep: OnboardingStep
    let progressSteps: [OnboardingStep]

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var currentPosition: Int {
        progressSteps.firstIndex(of: currentStep).map { $0 + 1 } ?? 0
    }

    private var totalCount: Int { progressSteps.count }

    private var fraction: CGFloat {
        guard totalCount > 0 else { return 0 }
        return CGFloat(currentPosition) / CGFloat(totalCount)
    }

    var body: some View {
        ZStack(alignment: .leading) {
            Rectangle()
                .fill(Color.outlineVariant)
            ProgressBarShape(progress: fraction)
                .fill(Color.pulpePrimary)
                .animation(reduceMotion ? nil : .easeOut(duration: DesignTokens.Animation.fast), value: fraction)
        }
        .frame(height: DesignTokens.FrameHeight.progressBarThin)
        .clipShape(.rect(cornerRadius: DesignTokens.FrameHeight.progressBarThin / 2))
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Étape \(currentPosition) sur \(totalCount), étape actuelle : \(currentStep.title)")
        .accessibilityValue("\(currentPosition) sur \(totalCount)")
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingProgressIndicator(
            currentStep: .firstName,
            progressSteps: [.firstName, .registration, .income, .charges, .savings, .budgetPreview]
        )
        OnboardingProgressIndicator(
            currentStep: .income,
            progressSteps: [.income, .charges, .savings, .budgetPreview]
        )
    }
    .padding()
}
