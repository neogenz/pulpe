import SwiftUI

/// Navigation buttons for onboarding steps with gradient primary button
struct OnboardingNavigationButtons: View {
    let step: OnboardingStep
    let canProceed: Bool
    let isLoading: Bool
    let onNext: () -> Void
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            // Primary button with gradient
            Button(action: onNext) {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    if isLoading {
                        ProgressView()
                            .tint(Color.textOnPrimary)
                    } else {
                        Text(buttonTitle)
                            .font(PulpeTypography.buttonPrimary)

                        if step != .registration {
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.inputLabel)
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(buttonBackground)
                .foregroundStyle(Color.textOnPrimary)
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .shadow(
                    color: canProceed ? Color.pulpePrimary.opacity(0.3) : .clear,
                    radius: 8,
                    y: 4
                )
            }
            .disabled(!canProceed || isLoading)
            .animation(.easeInOut(duration: 0.2), value: canProceed)

            // Back button
            if step != .welcome {
                Button(action: onBack) {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Image(systemName: "chevron.left")
                            .font(PulpeTypography.inputHelper)
                        Text("Retour")
                            .font(PulpeTypography.buttonSecondary)
                    }
                    .foregroundStyle(Color.textSecondaryOnboarding)
                }
                .padding(.top, DesignTokens.Spacing.xs)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.bottom, 32)
    }

    private var buttonTitle: String {
        switch step {
        case .registration: "Créer mon compte"
        case .welcome: "Commencer"
        default: "Continuer"
        }
    }

    @ViewBuilder
    private var buttonBackground: some View {
        if canProceed {
            Color.onboardingGradient
        } else {
            Color.secondary.opacity(0.5)
        }
    }
}

#Preview {
    VStack {
        Spacer()
        OnboardingNavigationButtons(
            step: .income,
            canProceed: true,
            isLoading: false,
            onNext: {},
            onBack: {}
        )
    }
}
