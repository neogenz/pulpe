import SwiftUI

/// Unified header for onboarding steps — bold editorial typography, no icon
struct OnboardingStepHeader: View {
    let step: OnboardingStep
    var titleOverride: String?
    var subtitleOverride: String?
    var onSkip: (() -> Void)?

    private var isCentered: Bool { step.onboardingHeaderIsCentered }

    private var stackAlignment: HorizontalAlignment { isCentered ? .center : .leading }

    private var textAlignment: TextAlignment { isCentered ? .center : .leading }

    var body: some View {
        VStack(alignment: stackAlignment, spacing: DesignTokens.Spacing.lg) {
            Text(titleOverride ?? step.title)
                .font(PulpeTypography.onboardingTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)
                .multilineTextAlignment(textAlignment)
                .frame(maxWidth: .infinity, alignment: frameAlignment)

            Text(subtitleOverride ?? step.subtitle)
                .font(PulpeTypography.onboardingSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(textAlignment)
                .frame(maxWidth: .infinity, alignment: frameAlignment)

            if step.isOptional {
                VStack(alignment: stackAlignment, spacing: DesignTokens.Spacing.sm) {
                    OptionalBadge(alignLeading: !isCentered)

                    if let onSkip {
                        Button("Passer cette étape") { onSkip() }
                            .font(PulpeTypography.buttonSecondary)
                            .foregroundStyle(Color.pulpePrimary)
                            .textLinkButtonStyle()
                            .frame(
                                maxWidth: .infinity,
                                minHeight: DesignTokens.TapTarget.minimum,
                                alignment: frameAlignment
                            )
                            .multilineTextAlignment(textAlignment)
                            .contentShape(Rectangle())
                    }
                }
            }
        }
    }

    private var frameAlignment: Alignment {
        isCentered ? .center : .leading
    }
}

/// Badge indicating a step is optional
struct OptionalBadge: View {
    var alignLeading: Bool = false

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
        .frame(maxWidth: alignLeading ? .infinity : nil, alignment: alignLeading ? .leading : .center)
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingStepHeader(step: .charges, onSkip: {})
        OnboardingStepHeader(step: .budgetPreview)
    }
    .padding()
}
