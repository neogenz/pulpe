import OSLog
import SwiftUI
import TipKit
import WidgetKit

enum DeepLinkDestination: Hashable {
    case addExpense(budgetId: String?)
    case viewBudget(budgetId: String)
    case resetPassword(url: URL)
}

@main
struct PulpeApp: App {
    @State private var appState = AppState()
    @State private var uiPreferences = UIPreferencesState()
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
                .environment(uiPreferences)
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
        case "reset-password":
            deepLinkDestination = .resetPassword(url: url)
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
    @Environment(UIPreferencesState.self) private var uiPreferences
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(\.scenePhase) private var scenePhase
    @Binding var deepLinkDestination: DeepLinkDestination?
    @State private var showAddExpenseSheet = false
    @State private var resetPasswordDeepLink: ResetPasswordDeepLink?
    @State private var showAmountsToggleAlert = false
    @State private var widgetSyncViewModel = WidgetSyncViewModel()
    @State private var privacyShieldActive = false

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

                case .needsPinSetup:
                    PinSetupView(
                        onComplete: { await appState.completePinSetup() },
                        onLogout: { await appState.logout() }
                    )

                case .needsPinEntry:
                    PinEntryView(
                        firstName: appState.currentUser?.firstName ?? "",
                        onSuccess: { Task { await appState.completePinEntry() } },
                        onForgotPin: { appState.startRecovery() },
                        onLogout: { await appState.logout() }
                    )

                case .needsPinRecovery:
                    PinRecoveryView(
                        onComplete: { Task { await appState.completeRecovery() } },
                        onCancel: { appState.cancelRecovery() }
                    )

                case .authenticated:
                    MainTabView()
                }
            }
        }
        .overlay {
            if shouldShowPrivacyShield {
                PrivacyShieldOverlay()
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
        .onReceive(NotificationCenter.default.publisher(for: .clientKeyCheckFailed)) { _ in
            Task { await appState.handleStaleClientKey() }
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
            // Activate shield only when leaving .active while in a secured state
            if newPhase != .active, oldPhase == .active {
                let isSecured = appState.authState == .authenticated || appState.authState == .needsPinEntry
                if isSecured {
                    privacyShieldActive = true
                }
            }
            if newPhase == .active {
                privacyShieldActive = false
            }

            if newPhase == .background {
                appState.handleEnterBackground()
                if appState.authState == .authenticated {
                    Task { await widgetSyncViewModel.syncWidgetData() }
                    BackgroundTaskService.shared.scheduleWidgetRefresh()
                }
            }

            if newPhase == .active, oldPhase != .active {
                appState.prepareForForeground()
                Task {
                    await appState.handleEnterForeground()
                    if appState.authState == .authenticated {
                        async let refreshCurrent: Void = currentMonthStore.forceRefresh()
                        async let refreshBudgets: Void = budgetListStore.forceRefresh()
                        async let refreshDashboard: Void = dashboardStore.loadIfNeeded()
                        _ = await (refreshCurrent, refreshBudgets, refreshDashboard)
                    }
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
        .alert(
            "Générer une clé de récupération ?",
            isPresented: $appState.showRecoveryKeyRepairConsent
        ) {
            Button("Générer maintenant") {
                Task { await appState.acceptRecoveryKeyRepairConsent() }
            }
            Button("Plus tard", role: .cancel) {
                Task { await appState.declineRecoveryKeyRepairConsent() }
            }
        } message: {
            Text("Ton coffre est configuré sans clé de récupération. Génère-la maintenant pour éviter de perdre l'accès à tes données chiffrées.")
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
        .sheet(item: $resetPasswordDeepLink) { deepLink in
            ResetPasswordFlowView(
                callbackURL: deepLink.url,
                onComplete: {
                    await appState.completePasswordResetFlow()
                },
                onCancel: {
                    await appState.cancelPasswordResetFlow()
                }
            )
        }
        .sheet(isPresented: $appState.showPostAuthRecoveryKeySheet) {
            if let recoveryKey = appState.postAuthRecoveryKey {
                RecoveryKeySheet(recoveryKey: recoveryKey) {
                    Task { await appState.completePostAuthRecoveryKeyPresentation() }
                }
            }
        }
        .onShake {
            guard appState.authState == .authenticated else { return }
            showAmountsToggleAlert = true
        }
        .alert(
            uiPreferences.amountsHidden ? "Afficher les montants ?" : "Masquer les montants ?",
            isPresented: $showAmountsToggleAlert
        ) {
            Button("Confirmer") {
                uiPreferences.toggleAmountsVisibility()
            }
            Button("Annuler", role: .cancel) {}
        }
        .environment(\.amountsHidden, uiPreferences.amountsHidden)
    }

    private var shouldShowPrivacyShield: Bool {
        privacyShieldActive || appState.isRestoringSession
    }

    private func handlePendingDeepLink() {
        guard let destination = deepLinkDestination else { return }

        switch destination {
        case .resetPassword(let url):
            deepLinkDestination = nil
            resetPasswordDeepLink = ResetPasswordDeepLink(url: url)
        case .addExpense:
            guard appState.authState == .authenticated else { return }
            deepLinkDestination = nil
            showAddExpenseSheet = true
        case .viewBudget(let budgetId):
            guard appState.authState == .authenticated else { return }
            deepLinkDestination = nil
            appState.budgetPath = NavigationPath()
            Task { @MainActor in
                appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
                appState.selectedTab = .budgets
            }
        }
    }
}

private struct PrivacyShieldOverlay: View {
    var body: some View {
        ZStack {
            Color(.systemBackground)
                .ignoresSafeArea()

            PulpeIcon(size: 44)
                .opacity(0.55)
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}

private struct ResetPasswordDeepLink: Identifiable {
    let id = UUID()
    let url: URL
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
                        Text(DomainErrorLocalizer.localize(error))
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
