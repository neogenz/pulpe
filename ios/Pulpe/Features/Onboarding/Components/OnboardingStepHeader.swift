import SwiftUI

/// Unified header for onboarding steps with animated icon
struct OnboardingStepHeader: View {
    let step: OnboardingStep
    @State private var iconScale: CGFloat = 0.5
    @State private var iconOpacity: Double = 0

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            // Animated icon in colored circle
            ZStack {
                Circle()
                    .fill(step.iconColor.opacity(0.12))
                    .frame(width: 80, height: 80)

                Image(systemName: step.iconName)
                    .font(PulpeTypography.brandTitle)
                    .foregroundStyle(step.iconColor)
                    .scaleEffect(iconScale)
                    .opacity(iconOpacity)
            }

            // Title
            Text(step.title)
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimaryOnboarding)

            // Subtitle
            Text(step.subtitle)
                .font(PulpeTypography.stepSubtitle)
                .foregroundStyle(Color.textSecondaryOnboarding)
                .multilineTextAlignment(.center)
                .padding(.horizontal, DesignTokens.Spacing.xxxl)

            // Optional badge
            if step.isOptional {
                OptionalBadge()
            }
        }
        .onAppear {
            withAnimation(PulpeAnimations.iconEntrance.delay(0.1)) {
                iconScale = 1.0
                iconOpacity = 1.0
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
        .background(Color.secondary.opacity(0.08), in: Capsule())
    }
}

#Preview {
    VStack(spacing: 40) {
        OnboardingStepHeader(step: .expenses)
        OnboardingStepHeader(step: .budgetPreview)
    }
    .padding()
}
