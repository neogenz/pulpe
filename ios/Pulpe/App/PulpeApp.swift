import SwiftUI

@main
struct PulpeApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(appState)
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        @Bindable var appState = appState

        Group {
            switch appState.authState {
            case .loading:
                LoadingView(message: "Chargement...")

            case .unauthenticated:
                if appState.hasCompletedOnboarding {
                    LoginView()
                } else {
                    OnboardingFlow()
                }

            case .authenticated:
                MainTabView()
                    .overlay {
                        if appState.showTutorial {
                            TutorialOverlay()
                        }
                    }
            }
        }
        .toastOverlay(appState.toastManager)
        .environment(appState.toastManager)
        .animation(.easeInOut(duration: 0.3), value: appState.authState)
        .task {
            await appState.checkAuthState()
        }
        .alert(
            "Activer \(BiometricService.shared.biometryDisplayName) ?",
            isPresented: $appState.showBiometricEnrollment
        ) {
            Button("Activer") {
                Task { await appState.enableBiometric() }
            }
            Button("Plus tard", role: .cancel) {}
        } message: {
            Text("Utilisez la reconnaissance biométrique pour vous connecter plus rapidement")
        }
    }
}
