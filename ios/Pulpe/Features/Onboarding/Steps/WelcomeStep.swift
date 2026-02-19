import SwiftUI

struct WelcomeStep: View {
    @State private var showLogin = false
    @State private var isAppeared = false
    let state: OnboardingState

    var body: some View {
        ZStack {
            // Full-screen gradient background
            Color.authGradientBackground
            
            VStack(spacing: 0) {
                Spacer()

                // Hero illustration with glow
                ZStack {
                    Circle()
                        .fill(Color.white.opacity(0.15))
                        .frame(width: 160, height: 160)
                        .blur(radius: 30)
                    
                    Circle()
                        .fill(Color.white.opacity(0.25))
                        .frame(width: 140, height: 140)

                    Image(systemName: "leaf.fill")
                        .font(.system(size: 64, weight: .medium))
                        .foregroundStyle(Color.pulpePrimary)
                        .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                }
                .scaleEffect(isAppeared ? 1 : 0.6)
                .opacity(isAppeared ? 1 : 0)

                Spacer()
                    .frame(height: DesignTokens.Spacing.xxxl)

                // Value proposition
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Text("Vois clair dans tes finances")
                        .font(.custom("Manrope-Bold", size: 34, relativeTo: .largeTitle))
                        .foregroundStyle(Color.textPrimaryOnboarding)
                        .multilineTextAlignment(.center)

                    Text("Planifie ton budget en 2 minutes, sans prise de tête")
                        .font(PulpeTypography.title3)
                        .foregroundStyle(Color.textSecondaryOnboarding)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, DesignTokens.Spacing.xxxl)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 20)

                Spacer()

                // Bottom buttons
                VStack(spacing: DesignTokens.Spacing.md) {
                    // Primary CTA - vibrant and eye-catching
                    Button {
                        state.nextStep()
                    } label: {
                        HStack(spacing: 8) {
                            Text("Commencer")
                                .fontWeight(.semibold)
                            Image(systemName: "arrow.right")
                                .font(.custom("DMSans-SemiBold", size: 15, relativeTo: .subheadline))
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: DesignTokens.FrameHeight.button)
                        .background(Color.pulpePrimary)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .shadow(color: Color.pulpePrimary.opacity(0.4), radius: 20, y: 10)
                    }

                    // Secondary action - more visible with proper contrast
                    Button {
                        showLogin = true
                    } label: {
                        Text("Se connecter")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .frame(height: DesignTokens.FrameHeight.button)
                            .foregroundStyle(Color.textPrimaryOnboarding)
                            .background {
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .fill(Color.white.opacity(0.4))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                                            .strokeBorder(Color.white.opacity(0.5), lineWidth: 1.5)
                                    }
                            }
                            .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xxl)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
                .opacity(isAppeared ? 1 : 0)
                .offset(y: isAppeared ? 0 : 10)
            }
        }
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
