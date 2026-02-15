import SwiftUI

struct WelcomeStep: View {
    @State private var showLogin = false
    @State private var isAppeared = false
    let state: OnboardingState

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Hero illustration
            ZStack {
                Circle()
                    .fill(Color.pulpePrimary.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: 140, height: 140)

                Image(systemName: "leaf")
                    .font(.system(size: 64, weight: .medium))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .scaleEffect(isAppeared ? 1 : 0.6)
            .opacity(isAppeared ? 1 : 0)

            Spacer()
                .frame(height: DesignTokens.Spacing.xxl)

            // Value proposition
            VStack(spacing: DesignTokens.Spacing.md) {
                Text("Vois clair dans tes finances")
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimaryOnboarding)
                    .multilineTextAlignment(.center)

                Text("Planifie ton budget en 2 minutes, sans prise de tête")
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, DesignTokens.Spacing.xxxl)
            .opacity(isAppeared ? 1 : 0)
            .offset(y: isAppeared ? 0 : 20)

            Spacer()

            // Bottom buttons
            VStack(spacing: DesignTokens.Spacing.md) {
                Button {
                    state.nextStep()
                } label: {
                    HStack(spacing: 8) {
                        Text("Commencer")
                            .font(PulpeTypography.buttonPrimary)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(Color.onboardingGradient)
                    .foregroundStyle(Color.textOnPrimary)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                    .shadow(color: Color.pulpePrimary.opacity(0.3), radius: 8, y: 4)
                }

                Button {
                    showLogin = true
                } label: {
                    Text("Se connecter")
                        .font(PulpeTypography.buttonPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: DesignTokens.FrameHeight.button)
                        .foregroundStyle(Color.textPrimary)
                        .background(Color.surfaceSecondary.opacity(0.6))
                        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.bottom, DesignTokens.Spacing.xxxl)
            .opacity(isAppeared ? 1 : 0)
            .offset(y: isAppeared ? 0 : 10)
        }
        .pulpeBackground()
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
        }
        .task {
            try? await Task.sleep(for: .milliseconds(100))
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isAppeared = true
            }
        }
    }
}

#Preview {
    WelcomeStep(state: OnboardingState())
        .environment(AppState())
}
