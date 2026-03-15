import GoogleSignIn
import OSLog
import SwiftUI
import TipKit

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
    @State private var appState: AppState
    @State private var uiPreferences = UIPreferencesState()
    @State private var currentMonthStore: CurrentMonthStore
    @State private var budgetListStore: BudgetListStore
    @State private var dashboardStore: DashboardStore
    @State private var userSettingsStore: UserSettingsStore
    @State private var runtimeCoordinator: AppRuntimeCoordinator
    @State private var deepLinkDestination: DeepLinkDestination?

    init() {
        let appState = AppState()
        let currentMonthStore = CurrentMonthStore()
        let budgetListStore = BudgetListStore()
        let dashboardStore = DashboardStore()
        let userSettingsStore = UserSettingsStore()

        appState.sessionDataResetter = LiveSessionDataResetter(
            currentMonthStore: currentMonthStore,
            budgetListStore: budgetListStore,
            dashboardStore: dashboardStore,
            userSettingsStore: userSettingsStore
        )

        _appState = State(initialValue: appState)
        _currentMonthStore = State(initialValue: currentMonthStore)
        _budgetListStore = State(initialValue: budgetListStore)
        _dashboardStore = State(initialValue: dashboardStore)
        _userSettingsStore = State(initialValue: userSettingsStore)
        _runtimeCoordinator = State(initialValue: AppRuntimeCoordinator(
            appState: appState,
            currentMonthStore: currentMonthStore,
            budgetListStore: budgetListStore,
            dashboardStore: dashboardStore
        ))

        try? Tips.configure([
            .datastoreLocation(.applicationDefault)
        ])
        BackgroundTaskService.shared.registerTasks()
        AnalyticsService.shared.initialize()
    }

    var body: some Scene {
        WindowGroup {
            if let uiTestScenario = UITestLaunchScenario.current {
                BudgetLongPressUITestHarness(scenario: uiTestScenario)
            } else {
                RootView(
                    runtimeCoordinator: runtimeCoordinator,
                    deepLinkDestination: $deepLinkDestination
                )
                    .environment(appState)
                    .environment(uiPreferences)
                    .environment(currentMonthStore)
                    .environment(budgetListStore)
                    .environment(dashboardStore)
                    .environment(userSettingsStore)
                    .onOpenURL { url in
                        handleDeepLink(url)
                    }
            }
        }
    }

    private func handleDeepLink(_ url: URL) {
        if url.scheme == "pulpe" {
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
            return
        }

        // OAuth callbacks (Google Sign-In) — only forward matching scheme
        if url.scheme?.hasPrefix("com.googleusercontent.apps") == true {
            GIDSignIn.sharedInstance.handle(url)
        }
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(UIPreferencesState.self) private var uiPreferences
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.scenePhase) private var scenePhase
    var runtimeCoordinator: AppRuntimeCoordinator
    @Binding var deepLinkDestination: DeepLinkDestination?
    @State private var showAddExpenseSheet = false
    @State private var resetPasswordDeepLink: ResetPasswordDeepLink?
    @State private var deepLinkHandler = DeepLinkHandler()
    @State private var showAmountsToggleAlert = false

    var body: some View {
        @Bindable var appState = appState

        Group {
            routeContent
        }
        .overlay {
            if runtimeCoordinator.shouldShowPrivacyShield {
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
                appState.send(.logoutRequested(source: .userInitiated))
            }
        } message: {
            Text("La configuration de ton compte n'a pas abouti — vérifie ta connexion et réessaie.")
        }
        .toastOverlay(appState.toastManager)
        .environment(appState.toastManager)
        .animation(.easeInOut(duration: DesignTokens.Animation.normal), value: appState.currentRoute)
        .onReceive(NotificationCenter.default.publisher(for: .maintenanceModeDetected)) { _ in
            appState.send(.maintenanceChecked(isInMaintenance: true))
        }
        .onReceive(NotificationCenter.default.publisher(for: .clientKeyCheckFailed)) { _ in
            handleClientKeyCheckFailed()
        }
        .onReceive(NotificationCenter.default.publisher(for: .sessionExpired)) { _ in
            appState.send(.sessionExpired)
        }
        .task {
            #if DEBUG
            Logger.auth.debug("[AUTH_ROOT_TASK] starting app")
            #endif
            await appState.start()
            #if DEBUG
            let authDesc = String(describing: appState.authState)
            let routeDesc = String(describing: appState.currentRoute)
            Logger.auth.debug(
                "[AUTH_ROOT_TASK] done, auth=\(authDesc, privacy: .public) route=\(routeDesc, privacy: .public)"
            )
            #endif
            if appState.authState == .authenticated {
                await userSettingsStore.loadIfNeeded()
                await currentMonthStore.loadBudgetSummary(
                    payDayOfMonth: userSettingsStore.payDayOfMonth
                )
            }
        }
        .onChange(of: appState.isInMaintenance) { oldValue, newValue in
            // Exiting maintenance mode: trigger auth check
            if oldValue && !newValue {
                Task { await appState.retryStartup() }
            }
        }
        .onChange(of: scenePhase) { oldPhase, newPhase in
            runtimeCoordinator.handleScenePhaseChange(from: oldPhase, to: newPhase)
        }
        .onChange(of: appState.currentRoute) { oldRoute, newRoute in
            #if DEBUG
            let old = String(describing: oldRoute)
            let new = String(describing: newRoute)
            Logger.auth.debug("[AUTH_ROUTE] \(old, privacy: .public) → \(new, privacy: .public)")
            #endif
        }
        .onChange(of: appState.authState) { oldAuth, newAuth in
            #if DEBUG
            let old = String(describing: oldAuth)
            let new = String(describing: newAuth)
            Logger.auth.debug("[AUTH_STATE_UI] \(old, privacy: .public) → \(new, privacy: .public)")
            #endif
        }
        .alert(
            "Générer une clé de récupération ?",
            isPresented: $appState.isRecoveryConsentVisible
        ) {
            Button("Générer maintenant") {
                appState.send(.recoveryKeyConsentAccepted)
            }
            Button("Plus tard", role: .cancel) {
                appState.send(.recoveryKeyConsentDeclined)
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
        .sheet(item: recoveryKeySheetItemBinding) { sheet in
            RecoveryKeySheet(recoveryKey: sheet.recoveryKey) {
                appState.send(.recoveryKeyPresentationDismissed)
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
            Button(uiPreferences.amountsHidden ? "Afficher" : "Masquer") {
                uiPreferences.toggleAmountsVisibility()
            }
            Button("Annuler", role: .cancel) {}
        }
        .environment(\.amountsHidden, uiPreferences.amountsHidden)
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
                    await userSettingsStore.loadIfNeeded()
                    await currentMonthStore.loadBudgetSummary(
                        payDayOfMonth: userSettingsStore.payDayOfMonth
                    )
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
                onComplete: { appState.send(.recoveryCompleted) },
                onCancel: { appState.send(.recoveryCancelled) },
                onSessionExpired: { appState.send(.recoverySessionExpired) }
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
                onComplete: { appState.send(.recoveryCompleted) },
                onCancel: { appState.send(.recoveryCancelled) },
                onSessionExpired: { appState.send(.recoverySessionExpired) }
            )
        case .loading, .unauthenticated:
            LoadingView(message: "Chargement...")
        }
    }

    private func pinEntryContent(canUseBiometric: Bool) -> some View {
        PinEntryView(
            firstName: appState.currentUser?.firstName ?? "",
            onSuccess: { appState.send(.pinEntrySucceeded) },
            onBiometric: canUseBiometric && appState.biometricCredentialsAvailable ? {
                Task {
                    guard await appState.attemptBiometricUnlock() else { return }
                    appState.send(.biometricUnlockSucceeded)
                }
            } : nil,
            onForgotPin: { appState.send(.recoveryInitiated) },
            onLogout: { await appState.logout() }
        )
    }

    private func handleClientKeyCheckFailed() {
        Task { await appState.handleStaleClientKey() }
    }

    private func handlePendingDeepLink() {
        if let destination = deepLinkDestination {
            switch destination {
            case .resetPassword:
                deepLinkHandler.setPending(destination)
                deepLinkDestination = nil
            case .addExpense:
                guard appState.authState == .authenticated else { break }
                deepLinkDestination = nil
                showAddExpenseSheet = true
            case .viewBudget(let budgetId):
                guard appState.authState == .authenticated else { break }
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
        Rectangle()
            .fill(.ultraThinMaterial)
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
