import SwiftUI

struct WelcomeStep: View {
    @State private var showLogin = false
    @State private var isAppeared = false
    let state: OnboardingState

    var body: some View {
        ZStack {
            // Full-screen gradient background
            Color.welcomeGradientBackground

            VStack(spacing: 0) {
                // Gradient breathing space
                Spacer()

                // Hero — PulpeIcon at the gradient/white transition
                PulpeIcon(size: 80)
                    .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
                    .scaleEffect(isAppeared ? 1 : 0.6)
                    .opacity(isAppeared ? 1 : 0)

                Spacer()
                    .frame(height: DesignTokens.Spacing.xxl)

                // Value proposition — sits on white zone
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Text("Vois clair dans tes finances")
                        .font(PulpeTypography.brandTitle)
                        .foregroundStyle(Color.textPrimaryOnboarding)
                        .multilineTextAlignment(.center)

                    Text("Ton budget est prêt en 2 minutes")
                        .font(PulpeTypography.onboardingSubtitle)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, DesignTokens.Spacing.xxxl)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 20)

                Spacer()
                    .frame(height: DesignTokens.Spacing.xxxl)

                // Bottom buttons
                VStack(spacing: DesignTokens.Spacing.md) {
                    // Primary CTA
                    Button {
                        AnalyticsService.shared.capture(.signupStarted, properties: ["method": "email"])
                        state.nextStep()
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.sm) {
                            Text("C'est parti")
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.labelLarge)
                        }
                    }
                    .primaryButtonStyle()

                    // Secondary action
                    Button {
                        showLogin = true
                    } label: {
                        Text("Se connecter")
                    }
                    .secondaryButtonStyle()
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 10)
            }
        }
        .task { AnalyticsService.shared.capture(.welcomeScreenViewed) }
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
        }
        .task {
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8).delay(0.1)) {
                isAppeared = true
            }
        }
    }
}

#Preview {
    WelcomeStep(state: OnboardingState())
        .environment(AppState())
}
