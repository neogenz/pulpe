import OSLog
import SwiftUI
import TipKit
import WidgetKit

struct ResetPasswordDeepLink: Identifiable {
    let id = UUID()
    let url: URL
}

struct RecoveryKeySheetItem: Identifiable, Equatable {
    let recoveryKey: String
    var id: String { recoveryKey }
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

        UISegmentedControl.appearance().selectedSegmentTintColor = UIColor(.pulpePrimary)
        UISegmentedControl.appearance().setTitleTextAttributes(
            [.foregroundColor: UIColor(.textOnPrimary)],
            for: .selected
        )
    }

    var body: some Scene {
        WindowGroup {
            if let uiTestScenario = UITestLaunchScenario.current {
                BudgetLongPressUITestHarness(scenario: uiTestScenario)
            } else {
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
    @State private var deepLinkHandler = DeepLinkHandler()
    @State private var showAmountsToggleAlert = false
    @State private var widgetSyncViewModel = WidgetSyncViewModel()
    @State private var privacyShieldActive = false

    var body: some View {
        @Bindable var appState = appState

        Group {
            routeContent
        }
        .overlay {
            if shouldShowPrivacyShield {
                PrivacyShieldOverlay()
            }
        }
        .alert(
            "Petit souci de connexion",
            isPresented: $appState.showPostAuthError
        ) {
            Button("Réessayer") {
                Task { await appState.retryOnboardingPostAuth() }
            }
            Button("Se déconnecter", role: .destructive) {
                Task { await appState.logout() }
            }
        } message: {
            Text("La configuration de ton compte n'a pas abouti — vérifie ta connexion et réessaie.")
        }
        .toastOverlay(appState.toastManager)
        .environment(appState.toastManager)
        .animation(.easeInOut(duration: DesignTokens.Animation.normal), value: appState.currentRoute)
        .onReceive(NotificationCenter.default.publisher(for: .maintenanceModeDetected)) { _ in
            handleMaintenanceDetected()
        }
        .onReceive(NotificationCenter.default.publisher(for: .clientKeyCheckFailed)) { _ in
            handleClientKeyCheckFailed()
        }
        .onReceive(NotificationCenter.default.publisher(for: .sessionExpired)) { _ in
            handleSessionExpired()
        }
        .task {
            await appState.start()
            if appState.authState == .authenticated {
                await currentMonthStore.loadBudgetSummary()
            }
        }
        .onChange(of: appState.isInMaintenance) { oldValue, newValue in
            // Exiting maintenance mode: trigger auth check
            if oldValue && !newValue {
                Task { await appState.retryStartup() }
            }
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            handleScenePhaseChange(from: oldPhase, to: newPhase)
        }
        .alert(
            "Générer une clé de récupération ?",
            isPresented: $appState.isRecoveryConsentVisible
        ) {
            Button("Générer maintenant") {
                Task { await appState.acceptRecoveryKeyRepairConsent() }
            }
            Button("Plus tard", role: .cancel) {
                Task { await appState.declineRecoveryKeyRepairConsent() }
            }
        } message: {
            Text(
                "Ton coffre est configuré sans clé de récupération. " +
                "Génère-la maintenant pour éviter de perdre l'accès à tes données chiffrées."
            )
        }
        .onChange(of: deepLinkDestination) { _, _ in
            handlePendingDeepLink()
        }
        .onChange(of: appState.authState) { _, newState in
            handlePendingDeepLink()
            if newState == .unauthenticated {
                currentMonthStore.reset()
                budgetListStore.reset()
                dashboardStore.reset()
            }
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
        .sheet(item: recoveryKeySheetItemBinding) { sheet in
            RecoveryKeySheet(recoveryKey: sheet.recoveryKey) {
                Task { await appState.completePostAuthRecoveryKeyPresentation() }
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

    private var recoveryKeySheetItemBinding: Binding<RecoveryKeySheetItem?> {
        Binding(
            get: {
                guard appState.isRecoveryKeySheetVisible,
                      let recoveryKey = appState.recoveryKeyForPresentation else {
                    return nil
                }
                return RecoveryKeySheetItem(recoveryKey: recoveryKey)
            },
            set: { newValue in
                if newValue == nil {
                    appState.isRecoveryKeySheetVisible = false
                }
            }
        )
    }

    // MARK: - Route Content

    /// Main content view driven by AppRoute.
    /// This is a pure function of state - no imperative logic.
    @ViewBuilder
    private var routeContent: some View {
        switch appState.currentRoute {
        case .loading:
            LoadingView(message: "Chargement...")

        case .maintenance:
            MaintenanceView()

        case .networkError:
            NetworkUnavailableView {
                await appState.retryStartup()
                if appState.authState == .authenticated {
                    await currentMonthStore.loadBudgetSummary()
                }
            }

        case .login:
            if appState.hasReturningUser {
                LoginView(
                    onBiometric: appState.biometricEnabled && appState.biometricCredentialsAvailable ? {
                        Task { await appState.loginWithBiometric() }
                    } : nil
                )
            } else {
                OnboardingFlow()
            }

        case .pinSetup:
            PinSetupView(
                onComplete: { await appState.completePinSetup() },
                onLogout: { await appState.logout() }
            )

        case .recoveryKeyConsent:
            recoveryOverlayBaseContent

        case .recoveryKeyPresentation:
            recoveryOverlayBaseContent

        case .pinEntry(let canUseBiometric):
            pinEntryContent(canUseBiometric: canUseBiometric)

        case .pinRecovery:
            PinRecoveryView(
                onComplete: { Task { await appState.completeRecovery() } },
                onCancel: { appState.cancelRecovery() },
                onSessionExpired: {
                    Task { await appState.handleRecoverySessionExpired() }
                }
            )

        case .main:
            MainTabView()
        }
    }

    @ViewBuilder
    private var recoveryOverlayBaseContent: some View {
        switch appState.authState {
        case .authenticated:
            MainTabView()
        case .needsPinEntry:
            pinEntryContent(canUseBiometric: appState.biometricEnabled && appState.biometricCredentialsAvailable)
        case .needsPinSetup:
            PinSetupView(
                onComplete: { await appState.completePinSetup() },
                onLogout: { await appState.logout() }
            )
        case .needsPinRecovery:
            PinRecoveryView(
                onComplete: { Task { await appState.completeRecovery() } },
                onCancel: { appState.cancelRecovery() },
                onSessionExpired: {
                    Task { await appState.handleRecoverySessionExpired() }
                }
            )
        case .loading, .unauthenticated:
            LoadingView(message: "Chargement...")
        }
    }

    private func pinEntryContent(canUseBiometric: Bool) -> some View {
        PinEntryView(
            firstName: appState.currentUser?.firstName ?? "",
            onSuccess: { Task { await appState.completePinEntry() } },
            onBiometric: canUseBiometric && appState.biometricCredentialsAvailable ? {
                Task {
                    guard await appState.attemptBiometricUnlock() else { return }
                    await appState.completePinEntry()
                }
            } : nil,
            onForgotPin: { appState.startRecovery() },
            onLogout: { await appState.logout() }
        )
    }

    private func handleMaintenanceDetected() {
        appState.setMaintenanceMode(true)
    }

    private func handleClientKeyCheckFailed() {
        Task { await appState.handleStaleClientKey() }
    }

    private func handleSessionExpired() {
        Task { await appState.handleSessionExpired() }
    }

    private func handleScenePhaseChange(from oldPhase: ScenePhase, to newPhase: ScenePhase) {
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

    private func handlePendingDeepLink() {
        if let destination = deepLinkDestination {
            switch destination {
            case .resetPassword:
                deepLinkHandler.setPending(destination)
                deepLinkDestination = nil
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

        switch deepLinkHandler.processResetPassword(authState: appState.authState) {
        case .present(let url):
            resetPasswordDeepLink = ResetPasswordDeepLink(url: url)
        case .deferred, .dropped, .noPending:
            break
        }
    }
}

struct PrivacyShieldOverlay: View {
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
