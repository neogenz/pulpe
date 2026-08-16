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
    @State private var savingsGoalStore: SavingsGoalStore
    @State private var tagStore: TagStore
    @State private var runtimeCoordinator: AppRuntimeCoordinator
    @State private var deepLinkDestination: DeepLinkDestination?
    @State private var appVersionStore = AppVersionStore()
    @State private var whatsNewStore = WhatsNewStore()

    init() {
        AnalyticsService.shared.initialize()

        let appState = AppState()
        let currentMonthStore = CurrentMonthStore()
        let budgetListStore = BudgetListStore()
        let dashboardStore = DashboardStore()
        let userSettingsStore = UserSettingsStore()
        let savingsGoalStore = SavingsGoalStore()
        let tagStore = TagStore()

        appState.sessionDataResetter = LiveSessionDataResetter(
            currentMonthStore: currentMonthStore,
            budgetListStore: budgetListStore,
            dashboardStore: dashboardStore,
            userSettingsStore: userSettingsStore,
            savingsGoalStore: savingsGoalStore,
            tagStore: tagStore
        )

        // Cross-store consistency (PUL-270): any amount-changing mutation on
        // the dashboard marks the sibling stores projecting the same sparse
        // aggregates stale, so their next loadIfNeeded() refetches.
        currentMonthStore.onMutation = { [budgetListStore, dashboardStore] in
            budgetListStore.invalidateCache()
            dashboardStore.invalidateCache()
        }

        // Any goal mutation touching budget data (delete-unlink, create with auto-décomposition, generation-stop freeze/remove) stales every aggregate store (PUL-270).
        savingsGoalStore.onBudgetDataMutation = { [currentMonthStore, budgetListStore, dashboardStore] in
            currentMonthStore.invalidateCache()
            budgetListStore.invalidateCache()
            dashboardStore.invalidateCache()
            BudgetDetailCache.shared.invalidateAll()
        }

        // Wire currency persistence from `OnboardingBootstrapper` to `UserSettingsStore`.
        // Runs after PIN setup completes so the API call carries `X-Client-Key`.
        // Returns `true` only when the store's optimistic update was confirmed by the
        // backend (no error after the await) — bootstrap toasts the user on `false`.
        appState.onboardingBootstrapper.persistCurrency = { [userSettingsStore] currency in
            await userSettingsStore.updateCurrency(currency)
            return userSettingsStore.error == nil
        }

        _appState = State(initialValue: appState)
        _currentMonthStore = State(initialValue: currentMonthStore)
        _budgetListStore = State(initialValue: budgetListStore)
        _dashboardStore = State(initialValue: dashboardStore)
        _userSettingsStore = State(initialValue: userSettingsStore)
        _savingsGoalStore = State(initialValue: savingsGoalStore)
        _tagStore = State(initialValue: tagStore)
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
    }

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            if let uiTestScenario = UITestLaunchScenario.current {
                uiTestHarness(for: uiTestScenario)
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
                    .environment(savingsGoalStore)
                    .environment(tagStore)
                    .environment(appVersionStore)
                    .environment(whatsNewStore)
                    .overlay(alignment: .topLeading) {
                        ToastOverlayWindowHost(toastManager: appState.toastManager)
                    }
                    .task {
                        await appVersionStore.check()
                    }
                    .onChange(of: scenePhase) { _, newPhase in
                        if newPhase == .active {
                            Task { await appVersionStore.check() }
                            Task { await rescheduleRemindersIfEnabled() }
                        }
                    }
                    .onChange(of: userSettingsStore.locale) { _, _ in
                        // The monthly reminder's copy is frozen at scheduling time, so
                        // without this the user reads a French nudge months after switching.
                        Task { await rescheduleRemindersIfEnabled() }
                    }
                    .onOpenURL { url in
                        handleDeepLink(url)
                    }
                    .fullScreenCover(isPresented: forceUpdateBinding) {
                        ForceUpdateView(storeURL: forceUpdateStoreURL)
                    }
                    .sheet(item: updateAvailableBinding) { update in
                        UpdateAvailableSheet(
                            version: update.version,
                            storeURL: update.storeURL,
                            onClose: appVersionStore.dismissUpdateAvailable
                        )
                        .standardSheetPresentation(detents: [.medium, .large])
                        .onAppear { appVersionStore.markUpdatePresented() }
                    }
                    // The whole interface language, in one line. Body text, plural variants,
                    // toolbar items and alerts re-resolve against it with no restart;
                    // `.navigationTitle` is the one exception and goes through
                    // `.localizedNavigationTitle`. Kept outermost: presentation content
                    // inherits the environment of its attachment point, so a cover attached
                    // outside this line — as the force-update cover once was — renders in
                    // the device language instead of the selector's.
                    .environment(\.locale, AppLocale.uiLocale(for: userSettingsStore.locale))
            }
        }
    }

    private var forceUpdateBinding: Binding<Bool> {
        Binding(
            get: {
                if case .forceUpdate = appVersionStore.status { return true }
                return false
            },
            set: { _ in }
        )
    }

    private var forceUpdateStoreURL: URL? {
        if case .forceUpdate(let url) = appVersionStore.status {
            return url
        }
        return nil
    }

    private var updateAvailableBinding: Binding<AppVersionStore.AvailableUpdate?> {
        Binding(
            get: {
                guard appState.authState == .authenticated,
                      whatsNewStore.allowsLowerPriorityPresentation,
                      case .updateAvailable(let update) = appVersionStore.status else {
                    return nil
                }
                return update
            },
            set: { update in
                if update == nil { appVersionStore.dismissUpdateAvailable() }
            }
        )
    }

    /// Refresh the monthly reminder on each foreground so it tracks a changed pay-day
    /// (or is re-armed after an OS-level change). No-op unless the user opted in and
    /// the real pay-day is loaded — skipping while `payDayOfMonth` is nil avoids
    /// re-arming on day 1 (the `?? 1` fallback would fire before `UserSettingsStore`
    /// loads, e.g. foregrounding on the PIN screen). Authorization is checked inside
    /// `scheduleMonthlyReminder` itself, which no-ops when not authorized.
    private func rescheduleRemindersIfEnabled() async {
        guard ReminderPreferences().remindersEnabled,
              let payDay = userSettingsStore.payDayOfMonth
        else { return }
        await NotificationScheduler.shared.scheduleMonthlyReminder(payDay: payDay)
    }

    /// Routes a UI test launch scenario to the matching harness.
    @ViewBuilder
    private func uiTestHarness(for scenario: UITestLaunchScenario) -> some View {
        switch scenario {
        case .budgetLongPressWithTransactions, .budgetLongPressEmpty:
            BudgetLongPressUITestHarness(scenario: scenario)
        case .budgetGoalSpreadMetadata:
            BudgetGoalSpreadUITestHarness()
        case .contextualCreationHome, .contextualCreationBudget:
            ContextualCreationUITestHarness(scenario: scenario)
        case .loginScreen:
            LoginFlowUITestHarness()
        case .savingsGoalForm,
             .savingsGoalFormInvalidInterval,
             .savingsGoalDetailNameOnly,
             .savingsGoalDetailTargetOnly,
             .savingsGoalDetailDeadlineOnly,
             .savingsGoalDetailFull,
             .savingsGoalDeadlineReconciliation,
             .savingsGoalTemplateLines:
            SavingsGoalIntervalUITestHarness(scenario: scenario)
        }
    }

    private func handleDeepLink(_ url: URL) {
        if let destination = DeepLinkDestination.resolve(url) {
            switch destination {
            case .addExpense:
                AnalyticsService.captureAuthSessionDiagnostic(
                    source: "deep_link",
                    outcome: "widget_add_expense_received"
                )
            case .viewBudget:
                AnalyticsService.captureAuthSessionDiagnostic(
                    source: "deep_link",
                    outcome: "widget_budget_received"
                )
            case .resetPassword:
                break
            }
            deepLinkDestination = destination
            return
        }

        // OAuth callbacks (Google Sign-In) — only forward matching scheme
        if url.scheme?.hasPrefix("com.googleusercontent.apps") == true {
            GIDSignIn.sharedInstance.handle(url)
            return
        }

        Logger.app.warning("Deep link rejected")
    }
}

struct RootView: View {
    @Environment(AppState.self) private var appState
    @Environment(UIPreferencesState.self) private var uiPreferences
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(WhatsNewStore.self) private var whatsNewStore
    @Environment(\.scenePhase) private var scenePhase
    var runtimeCoordinator: AppRuntimeCoordinator
    @Binding var deepLinkDestination: DeepLinkDestination?
    @State private var showAddExpenseSheet = false
    @State private var resetPasswordDeepLink: ResetPasswordDeepLink?
    @State private var deepLinkHandler = DeepLinkHandler()
    @State private var showAmountsToggleAlert = false

    var body: some View {
        Group {
            routeContent
        }
        .overlay {
            if runtimeCoordinator.shouldShowPrivacyShield {
                PrivacyShieldOverlay()
            }
        }
        .modifier(RootViewAlerts(
            appState: appState,
            uiPreferences: uiPreferences,
            showAmountsToggleAlert: $showAmountsToggleAlert
        ))
        .modifier(RootViewSheets(
            appState: appState,
            whatsNewStore: whatsNewStore,
            showAddExpenseSheet: $showAddExpenseSheet,
            resetPasswordDeepLink: $resetPasswordDeepLink,
            recoveryKeySheetItemBinding: recoveryKeySheetItemBinding
        ))
        .modifier(RootViewLifecycle(
            appState: appState,
            runtimeCoordinator: runtimeCoordinator,
            scenePhase: scenePhase,
            deepLinkDestination: deepLinkDestination,
            onAppStart: handleAppStart,
            onWhatsNewCheck: { await whatsNewStore.check() },
            onClientKeyCheckFailed: handleClientKeyCheckFailed,
            onPendingDeepLink: handlePendingDeepLink
        ))
        .syncCurrencyAnalytics()
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
            LoadingView(message: AppLocale.string("Chargement..."))

        case .maintenance:
            MaintenanceView()

        case .networkError:
            NetworkUnavailableView(
                onRetry: {
                    await appState.retryStartup()
                    if appState.authState == .authenticated {
                        await userSettingsStore.loadIfNeeded()
                        await currentMonthStore.loadBudgetSummary(
                            payDayOfMonth: userSettingsStore.payDayOfMonth
                        )
                        await whatsNewStore.check()
                    }
                },
                onSignOut: { await appState.abandonStartupRetry() }
            )

        case .login:
            if appState.hasReturningUser {
                LoginView()
            } else {
                OnboardingFlow(pendingUser: appState.pendingOnboardingUser)
                    .id(appState.onboardingSessionID)
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
            LoadingView(message: AppLocale.string("Chargement..."))
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

    private func handleAppStart() async {
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
