import SwiftUI
import WidgetKit

enum DeepLinkDestination: Hashable {
    case addExpense(budgetId: String?)
    case viewBudget(budgetId: String)
}

@main
struct PulpeApp: App {
    @State private var appState = AppState()
    @State private var deepLinkDestination: DeepLinkDestination?

    init() {
        BackgroundTaskService.shared.registerTasks()
    }

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

        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)

        switch url.host {
        case "add-expense":
            let budgetId = components?.queryItems?.first { $0.name == "budgetId" }?.value
            deepLinkDestination = .addExpense(budgetId: budgetId)
        case "budget":
            if let budgetId = components?.queryItems?.first(where: { $0.name == "id" })?.value {
                deepLinkDestination = .viewBudget(budgetId: budgetId)
            }
        default:
            break
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.scenePhase) private var scenePhase
    @Binding var deepLinkDestination: DeepLinkDestination?
    @State private var showAddExpenseSheet = false
    @State private var widgetSyncViewModel = WidgetSyncViewModel()

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
        .onChange(of: scenePhase) { _, newPhase in
            if newPhase == .background, appState.authState == .authenticated {
                Task { await widgetSyncViewModel.syncWidgetData() }
                BackgroundTaskService.shared.scheduleWidgetRefresh()
            }
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
        .onChange(of: deepLinkDestination) { _, _ in
            handlePendingDeepLink()
        }
        .onChange(of: appState.authState) { _, _ in
            handlePendingDeepLink()
        }
        .sheet(isPresented: $showAddExpenseSheet) {
            DeepLinkAddExpenseSheet()
                .environment(appState.toastManager)
        }
    }

    private func handlePendingDeepLink() {
        guard appState.authState == .authenticated,
              let destination = deepLinkDestination else { return }

        deepLinkDestination = nil

        switch destination {
        case .addExpense:
            showAddExpenseSheet = true
        case .viewBudget(let budgetId):
            appState.selectedTab = .budgets
            appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
        }
    }
}

@Observable @MainActor
final class WidgetSyncViewModel {
    private let budgetService = BudgetService.shared

    func syncWidgetData() async {
        guard let currentBudget = try? await budgetService.getCurrentMonthBudget(),
              let details = try? await budgetService.getBudgetWithDetails(id: currentBudget.id) else {
            await WidgetDataSyncService.shared.sync(budgetsWithDetails: [], currentBudgetDetails: nil)
            return
        }

        do {
            let exportData = try await budgetService.exportAllBudgets()
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: exportData.budgets,
                currentBudgetDetails: details
            )
        } catch {
            #if DEBUG
            print("WidgetSyncViewModel: exportAllBudgets failed - \(error)")
            #endif
            await WidgetDataSyncService.shared.sync(
                budgetsWithDetails: [],
                currentBudgetDetails: details
            )
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
                } else if let error = viewModel.error {
                    ContentUnavailableView {
                        Label("Erreur de connexion", systemImage: "wifi.exclamationmark")
                    } description: {
                        Text(error.localizedDescription)
                    } actions: {
                        Button("Réessayer") {
                            Task { await viewModel.loadCurrentBudget() }
                        }
                        .buttonStyle(.bordered)
                    }
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

@Observable @MainActor
final class DeepLinkAddExpenseViewModel {
    private(set) var currentBudgetId: String?
    private(set) var isLoading = true
    private(set) var error: Error?

    func loadCurrentBudget() async {
        isLoading = true
        error = nil
        do {
            let budget = try await BudgetService.shared.getCurrentMonthBudget()
            currentBudgetId = budget?.id
        } catch {
            self.error = error
            currentBudgetId = nil
        }
        isLoading = false
    }
}
