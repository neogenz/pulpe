import SwiftUI

struct WelcomeStep: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showLogin = false
    @State private var isAppeared = false
    let state: OnboardingState

    private static let consentMarkdown = AppURLs.legalDisclosure(
        prefix: "En continuant, tu acceptes nos",
        connector: "notre",
        suffix: "."
    )

    var body: some View {
        ZStack {
            // Full-screen gradient background
            Color.welcomeGradientBackground

            VStack(spacing: 0) {
                // Gradient breathing space
                Spacer()

                // Hero — PulpeIcon at the gradient/white transition
                PulpeIcon(size: 80)
                    .shadow(DesignTokens.Shadow.elevated)
                    .shadow(color: Color.pulpePrimary.opacity(0.3), radius: 20, y: 8)
                    .scaleEffect(isAppeared ? 1 : 0.6)
                    .opacity(isAppeared ? 1 : 0)
                    .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring, value: isAppeared)

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
                        .foregroundStyle(Color.textPrimaryOnboarding)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, DesignTokens.Spacing.xxxl)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 20)
                .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.15), value: isAppeared)

                Spacer()
                    .frame(height: DesignTokens.Spacing.xxxl)

                // Bottom buttons
                VStack(spacing: DesignTokens.Spacing.md) {
                    // Social login — primary path (onboarding context)
                    SocialLoginSection(onAuthenticated: { user in
                        state.configureSocialUser(user)
                        state.nextStep()
                    })

                    // Implicit consent disclosure for social signups
                    // (email path has its own checkbox in RegistrationStep)
                    Text(Self.consentMarkdown)
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(Color.textTertiaryOnboarding)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .tint(Color.pulpePrimary)

                    SocialLoginDivider()

                    // Email signup — secondary path
                    Button {
                        AnalyticsService.shared.capture(.signupStarted, properties: ["method": "email"])
                        state.nextStep()
                    } label: {
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            Text("S'inscrire avec email")
                            Image(systemName: "arrow.right")
                                .font(PulpeTypography.labelLarge)
                        }
                        .font(PulpeTypography.buttonSecondary)
                        .foregroundStyle(Color.pulpePrimary)
                    }
                    .textLinkButtonStyle()
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Rectangle())

                    // Existing user — tertiary path
                    Button {
                        showLogin = true
                    } label: {
                        Text("J'ai déjà un compte")
                            .font(PulpeTypography.buttonSecondary)
                            .foregroundStyle(Color.textSecondaryOnboarding)
                    }
                    .textLinkButtonStyle()
                    .frame(minHeight: DesignTokens.TapTarget.minimum)
                    .contentShape(Rectangle())
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 10)
                .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.35), value: isAppeared)
            }
        }
        .task { AnalyticsService.shared.capture(.welcomeScreenViewed) }
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
        }
        .task {
            if reduceMotion {
                isAppeared = true
            } else {
                withAnimation(DesignTokens.Animation.entranceSpring.delay(0.1)) {
                    isAppeared = true
                }
            }
        }
    }
}

#Preview {
    WelcomeStep(state: OnboardingState())
        .environment(AppState())
}
