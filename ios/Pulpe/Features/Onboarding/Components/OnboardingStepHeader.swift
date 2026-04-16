import SwiftUI

/// Unified header for onboarding steps — bold editorial typography, no icon
struct OnboardingStepHeader: View {
    let step: OnboardingStep
    var titleOverride: String?
    var subtitleOverride: String?
    var onSkip: (() -> Void)?
    /// Budget recap is treated as a success beat — keep the header centered there only.
    var useCenteredLayout: Bool = false

    private var stackAlignment: HorizontalAlignment {
        useCenteredLayout ? .center : .leading
    }

    private var textAlignment: TextAlignment {
        useCenteredLayout ? .center : .leading
    }

    var body: some View {
        VStack(alignment: stackAlignment, spacing: DesignTokens.Spacing.lg) {
            Text(titleOverride ?? step.title)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)
                .multilineTextAlignment(textAlignment)
                .frame(maxWidth: .infinity, alignment: useCenteredLayout ? .center : .leading)

            Text(subtitleOverride ?? step.subtitle)
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(textAlignment)
                .frame(maxWidth: .infinity, alignment: useCenteredLayout ? .center : .leading)

            if step.isOptional {
                VStack(alignment: stackAlignment, spacing: DesignTokens.Spacing.sm) {
                    OptionalBadge()

                    if let onSkip {
                        Button("Passer cette étape") { onSkip() }
                            .font(PulpeTypography.buttonSecondary)
                            .foregroundStyle(Color.pulpePrimary)
                            .textLinkButtonStyle()
                            .frame(minHeight: DesignTokens.TapTarget.minimum)
                            .contentShape(Rectangle())
                    }
                }
                .frame(maxWidth: .infinity, alignment: useCenteredLayout ? .center : .leading)
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
            Text("Optionnel")
                .font(PulpeTypography.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(Color.textTertiaryOnboarding)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(Color.textTertiaryOnboarding.opacity(0.15), in: Capsule())
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingStepHeader(step: .charges, onSkip: {})
        OnboardingStepHeader(step: .budgetPreview, useCenteredLayout: true)
    }
    .padding()
}
