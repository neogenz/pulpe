import SwiftUI

struct WelcomeStep: View {
    @Environment(AppState.self) private var appState
    @State private var showLogin = false
    let state: OnboardingState

    var body: some View {
        OnboardingStepView(
            step: .welcome,
            state: state,
            canProceed: true,
            onNext: { state.nextStep() }
        ) {
            VStack(spacing: 32) {
                // Logo
                Image(systemName: "banknote.fill")
                    .font(.system(size: 80))
                    .foregroundStyle(.tint)
                    .padding(.top, 40)

                // Features
                VStack(spacing: 24) {
                    FeatureRow(
                        icon: "chart.bar.fill",
                        title: "Suivez vos dépenses",
                        description: "Visualisez où va votre argent chaque mois"
                    )

                    FeatureRow(
                        icon: "target",
                        title: "Atteignez vos objectifs",
                        description: "Planifiez et épargnez efficacement"
                    )

                    FeatureRow(
                        icon: "calendar",
                        title: "Budget mensuel",
                        description: "Un budget clair pour chaque mois"
                    )
                }

                // Login link
                VStack(spacing: 8) {
                    Text("Déjà un compte ?")
                        .foregroundStyle(.secondary)

                    Button("Se connecter") {
                        showLogin = true
                    }
                    .fontWeight(.medium)
                }
                .font(.subheadline)
            }
        }
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
