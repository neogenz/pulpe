import SwiftUI
import WidgetKit

enum DeepLinkDestination: Hashable {
    case addExpense(budgetId: String?)
}

@main
struct PulpeApp: App {
    @State private var appState = AppState()
    @State private var deepLinkDestination: DeepLinkDestination?

    var body: some Scene {
        WindowGroup {
            RootView(deepLinkDestination: $deepLinkDestination)
                .environment(appState)
                .onOpenURL { url in
                    handleDeepLink(url)
                }
        }
    }

    private func handleDeepLink(_ url: URL) {
        guard url.scheme == "pulpe" else { return }

        switch url.host {
        case "add-expense":
            let budgetId = URLComponents(url: url, resolvingAgainstBaseURL: false)?
                .queryItems?
                .first { $0.name == "budgetId" }?
                .value
            deepLinkDestination = .addExpense(budgetId: budgetId)
        default:
            break
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Binding var deepLinkDestination: DeepLinkDestination?
    @State private var showAddExpenseSheet = false

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
        .onChange(of: deepLinkDestination) { _, newValue in
            if case .addExpense = newValue, appState.authState == .authenticated {
                showAddExpenseSheet = true
            }
        }
        .sheet(isPresented: $showAddExpenseSheet) {
            deepLinkDestination = nil
        } content: {
            DeepLinkAddExpenseSheet()
        }
    }
}

struct DeepLinkAddExpenseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = DeepLinkAddExpenseViewModel()

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading {
                    LoadingView(message: "Chargement...")
                } else if let budgetId = viewModel.currentBudgetId {
                    AddTransactionSheet(budgetId: budgetId) { _ in
                        dismiss()
                    }
                } else {
                    ContentUnavailableView(
                        "Aucun budget",
                        systemImage: "calendar.badge.exclamationmark",
                        description: Text("Créez d'abord un budget pour ce mois")
                    )
                }
            }
            .task {
                await viewModel.loadCurrentBudget()
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
}

@Observable
final class DeepLinkAddExpenseViewModel {
    private(set) var currentBudgetId: String?
    private(set) var isLoading = true

    @MainActor
    func loadCurrentBudget() async {
        isLoading = true
        do {
            let budget = try await BudgetService.shared.getCurrentMonthBudget()
            currentBudgetId = budget?.id
        } catch {
            currentBudgetId = nil
        }
        isLoading = false
    }
}
