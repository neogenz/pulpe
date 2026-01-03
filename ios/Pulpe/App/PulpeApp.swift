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
        .animation(.easeInOut(duration: 0.3), value: appState.authState)
        .task {
            await appState.checkAuthState()
        }
    }
}
