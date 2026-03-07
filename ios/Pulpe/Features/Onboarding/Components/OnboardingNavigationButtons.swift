import SwiftUI

/// Navigation buttons for onboarding steps with gradient primary button
struct OnboardingNavigationButtons: View {
    let step: OnboardingStep
    let canProceed: Bool
    let isLoading: Bool
    let onNext: () -> Void
    let onBack: () -> Void

    private var isEnabled: Bool {
        canProceed && !isLoading
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Button(action: onNext) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Chargement")
                } else {
                    HStack(spacing: DesignTokens.Spacing.sm) {
                        Text(buttonTitle)

                        if step != .registration {
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.labelLarge)
                        }
                    }
                }
            }
            .primaryButtonStyle(isEnabled: isEnabled)
            .disabled(!isEnabled)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isEnabled)

            // Back button
            if step != .welcome {
                Button(action: onBack) {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Image(systemName: "chevron.left")
                            .font(PulpeTypography.footnote)
                        Text("Retour")
                            .font(PulpeTypography.buttonSecondary)
                    }
                    .foregroundStyle(Color.textSecondaryOnboarding)
                }
                .padding(.top, DesignTokens.Spacing.xs)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
        .padding(.bottom, DesignTokens.Spacing.xxxl)
    }

    private var buttonTitle: String {
        switch step {
        case .registration: "Créer mon compte"
        case .welcome: "Commencer"
        default: "Continuer"
        }
    }
}

#Preview {
    VStack {
        Spacer()
        OnboardingNavigationButtons(
            step: .expenses,
            canProceed: true,
            isLoading: false,
            onNext: {},
            onBack: {}
        )
    }
}
