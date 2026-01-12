import SwiftUI

/// Navigation buttons for onboarding steps with gradient primary button
struct OnboardingNavigationButtons: View {
    let step: OnboardingStep
    let canProceed: Bool
    let isLoading: Bool
    let onNext: () -> Void
    let onBack: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            // Primary button with gradient
            Button(action: onNext) {
                HStack(spacing: 8) {
                    if isLoading {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text(buttonTitle)
                            .font(PulpeTypography.buttonPrimary)

                        if step != .registration {
                            Image(systemName: "arrow.right")
                                .font(.system(size: 14, weight: .semibold))
                        }
                    }
                }
                .frame(maxWidth: .infinity)
                .frame(height: 54)
                .background(buttonBackground)
                .foregroundStyle(.white)
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
                    HStack(spacing: 4) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .semibold))
                        Text("Retour")
                            .font(PulpeTypography.buttonSecondary)
                    }
                    .foregroundStyle(Color.textSecondaryOnboarding)
                }
                .padding(.top, 4)
            }
        }
        .padding(.horizontal, 24)
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
