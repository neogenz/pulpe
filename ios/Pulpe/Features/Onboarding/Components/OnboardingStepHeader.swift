import SwiftUI

/// Unified header for onboarding steps — bold editorial typography, no icon
struct OnboardingStepHeader: View {
    let step: OnboardingStep
    var titleOverride: String?
    var subtitleOverride: String?

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Text(titleOverride ?? step.title)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            Text(subtitleOverride ?? step.subtitle)
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(.center)
                .padding(.horizontal, DesignTokens.Spacing.lg)

            if step.isOptional {
                OptionalBadge()
            }
        }
    }
}

/// Badge indicating a step is optional
struct OptionalBadge: View {
    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Image(systemName: "arrow.right.circle")
                .font(PulpeTypography.caption2)
            Text("Optionnel — tu peux passer")
                .font(PulpeTypography.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(Color.textTertiaryOnboarding)
        .padding(.horizontal, 14)
        .padding(.vertical, 6)
        .background(Color.textTertiaryOnboarding.opacity(0.15), in: Capsule())
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingStepHeader(step: .charges)
        OnboardingStepHeader(step: .budgetPreview)
    }
    .padding()
}
