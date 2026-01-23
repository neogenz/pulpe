import SwiftUI

struct WelcomeStep: View {
    @Environment(AppState.self) private var appState
    @State private var showLogin = false
    let state: OnboardingState

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 24) {
                    // Logo and title
                    VStack(spacing: 12) {
                        PulpeIcon(size: 80)

                        Text("Pulpe")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(Color.pulpePrimary)

                        Text("Reprends le contrôle de tes finances")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondaryOnboarding)
                    }
                    .padding(.top, 40)

                    // Lottie animation
                    WelcomeLottieView()

                    // Features
                    VStack(spacing: 20) {
                        FeatureRow(
                            icon: "chart.bar.fill",
                            title: "Suis tes dépenses",
                            description: "Visualise où va ton argent chaque mois"
                        )

                        FeatureRow(
                            icon: "target",
                            title: "Atteins tes objectifs",
                            description: "Planifie et épargne sereinement"
                        )

                        FeatureRow(
                            icon: "calendar",
                            title: "Budget mensuel",
                            description: "Un budget clair pour chaque mois"
                        )
                    }
                    .padding(.horizontal, 24)
                }
            }
            .scrollBounceBehavior(.basedOnSize)

            Spacer()

            // Bottom buttons
            VStack(spacing: 16) {
                // Primary button
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
                    .frame(height: 54)
                    .background(Color.onboardingGradient)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .shadow(color: Color.pulpePrimary.opacity(0.3), radius: 8, y: 4)
                }

                // Login link
                HStack(spacing: 4) {
                    Text("Déjà un compte ?")
                        .foregroundStyle(.secondary)
                    Button("Se connecter") {
                        showLogin = true
                    }
                    .fontWeight(.semibold)
                }
                .font(.subheadline)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 32)
        }
        .background(Color.onboardingBackground)
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let title: String
    let description: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(.tint)
                .frame(width: 44, height: 44)
                .background(.tint.opacity(0.1), in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }
}

#Preview {
    WelcomeStep(state: OnboardingState())
        .environment(AppState())
}
