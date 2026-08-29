import SwiftUI

/// Header of an onboarding step: the question alone. Skipping an optional step is
/// « Continuer » with empty fields, so there is no badge and no skip link.
struct OnboardingStepHeader: View {
    let step: OnboardingStep

    private var isCentered: Bool { step.onboardingHeaderIsCentered }

    var body: some View {
        Text(step.title)
            .font(PulpeTypography.onboardingTitle)
            .foregroundStyle(Color.textPrimaryOnboarding)
            .multilineTextAlignment(isCentered ? .center : .leading)
            .frame(maxWidth: .infinity, alignment: isCentered ? .center : .leading)
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingStepHeader(step: .charges)
        OnboardingStepHeader(step: .budgetPreview)
    }
    .padding()
}
