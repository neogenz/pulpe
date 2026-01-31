import OSLog
import SwiftUI
import TipKit
import WidgetKit

enum DeepLinkDestination: Hashable {
    case addExpense(budgetId: String?)
    case viewBudget(budgetId: String)
}

@main
struct PulpeApp: App {
    @State private var appState = AppState()
    @State private var currentMonthStore = CurrentMonthStore()
    @State private var budgetListStore = BudgetListStore()
    @State private var dashboardStore = DashboardStore()
    @State private var deepLinkDestination: DeepLinkDestination?

    init() {
        try? Tips.configure([
            .datastoreLocation(.applicationDefault)
        ])
        BackgroundTaskService.shared.registerTasks()
    }

    var body: some Scene {
        WindowGroup {
            RootView(deepLinkDestination: $deepLinkDestination)
                .environment(appState)
                .environment(currentMonthStore)
                .environment(budgetListStore)
                .environment(dashboardStore)
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
            if let budgetId, UUID(uuidString: budgetId) == nil {
                Logger.app.warning("Deep link: invalid UUID for add-expense budgetId=\(budgetId)")
                break
            }
            deepLinkDestination = .addExpense(budgetId: budgetId)
        case "budget":
            if let budgetId = components?.queryItems?.first(where: { $0.name == "id" })?.value,
               UUID(uuidString: budgetId) != nil {
                deepLinkDestination = .viewBudget(budgetId: budgetId)
            } else {
                Logger.app.warning("Deep link: invalid or missing UUID for budget path")
            }
        default:
            Logger.app.warning("Deep link: unrecognized host=\(url.host ?? "nil")")
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(\.scenePhase) private var scenePhase
    @Binding var deepLinkDestination: DeepLinkDestination?
    @State private var showAddExpenseSheet = false
    @State private var widgetSyncViewModel = WidgetSyncViewModel()

    var body: some View {
        @Bindable var appState = appState

        Group {
            if appState.isNetworkUnavailable {
                NetworkUnavailableView {
                    await appState.retryNetworkCheck()
                    if appState.authState == .authenticated {
                        await currentMonthStore.loadBudgetSummary()
                    }
                }
            } else if appState.isInMaintenance {
                MaintenanceView()
            } else {
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
                }
            }
        }
        .toastOverlay(appState.toastManager)
        .environment(appState.toastManager)
        .animation(.easeInOut(duration: DesignTokens.Animation.normal), value: appState.authState)
        .animation(.easeInOut(duration: DesignTokens.Animation.normal), value: appState.isInMaintenance)
        .animation(.easeInOut(duration: DesignTokens.Animation.normal), value: appState.isNetworkUnavailable)
        .onReceive(NotificationCenter.default.publisher(for: .maintenanceModeDetected)) { _ in
            appState.setMaintenanceMode(true)
        }
        .task {
            await appState.checkMaintenanceStatus()
            guard !appState.isInMaintenance, !appState.isNetworkUnavailable else { return }
            await appState.checkAuthState()
            if appState.authState == .authenticated {
                await currentMonthStore.loadBudgetSummary()
            }
        }
        .onChange(of: appState.isInMaintenance) { oldValue, newValue in
            // Exiting maintenance mode: trigger auth check
            if oldValue && !newValue {
                Task { await appState.checkAuthState() }
            }
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            if newPhase == .background, appState.authState == .authenticated {
                Task { await widgetSyncViewModel.syncWidgetData() }
                BackgroundTaskService.shared.scheduleWidgetRefresh()
            }

            // CRITICAL: Always refresh when app comes to foreground
            // This guarantees fresh data if user edited from web
            if newPhase == .active, oldPhase == .background, appState.authState == .authenticated {
                Task {
                    async let refreshCurrent: Void = currentMonthStore.forceRefresh()
                    async let refreshBudgets: Void = budgetListStore.forceRefresh()
                    async let refreshDashboard: Void = dashboardStore.loadIfNeeded()
                    _ = await (refreshCurrent, refreshBudgets, refreshDashboard)
                }
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
            Text("Utilise la reconnaissance biométrique pour te connecter plus rapidement")
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
            appState.budgetPath = NavigationPath()
            Task { @MainActor in
                appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                appState.selectedTab = .budgets
            }
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
            Logger.sync.error("WidgetSyncViewModel: exportAllBudgets failed - \(error)")
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
                        "Pas encore de budget",
                        systemImage: "calendar.badge.exclamationmark",
                        description: Text("Crée d'abord un budget pour ce mois")
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
