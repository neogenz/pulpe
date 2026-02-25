// swiftlint:disable file_length type_body_length
import OSLog
import SwiftUI
import WidgetKit

@Observable @MainActor
final class AppState {
    // MARK: - UserDefaults Keys

    private enum UserDefaultsKey {
        static let hasLaunchedBefore = "pulpe-has-launched-before"
        static let didExplicitLogout = "pulpe-did-explicit-logout"
        static let manualBiometricRetryRequired = "pulpe-manual-biometric-retry-required"
    }

    // MARK: - Auth State

    enum AuthStatus: Equatable {
        case loading
        case unauthenticated
        case needsPinSetup
        case needsPinEntry
        case needsPinRecovery
        case authenticated
    }

    enum RecoveryFlowState: Equatable, Sendable {
        case idle
        case consentPrompt
        case generatingKey
        case presentingKey(String)

        var isModalActive: Bool {
            switch self {
            case .idle: return false
            case .consentPrompt, .generatingKey, .presentingKey: return true
            }
        }
    }

    enum AuthCompletionContext: String, Sendable {
        case pinSetup = "pin_setup"
        case pinEntry = "pin_entry"
        case pinRecovery = "pin_recovery"
        case recoveryKeyConflict = "recovery_key_conflict"
        case recoveryKeyError = "recovery_key_error"
        case recoveryKeyDeclined = "recovery_key_declined"
        case recoveryKeyPresented = "recovery_key_presented"
        case directAuthenticated = "direct_authenticated"

        var reason: String { rawValue }

        var allowsAutomaticEnrollment: Bool {
            switch self {
            case .pinSetup, .pinEntry, .pinRecovery,
                 .recoveryKeyConflict, .recoveryKeyError,
                 .recoveryKeyDeclined, .recoveryKeyPresented:
                return true
            case .directAuthenticated:
                return false
            }
        }
    }

    enum LogoutSource {
        case userInitiated
        case system
    }

    private(set) var authState: AuthStatus = .loading
    private(set) var currentUser: UserInfo?
    var showPostAuthError = false

    // MARK: - Maintenance & Network State

    private(set) var isInMaintenance = false
    private(set) var isNetworkUnavailable = false

    // MARK: - Navigation

    var selectedTab: Tab = .currentMonth
    var budgetPath = NavigationPath()
    var templatePath = NavigationPath()

    // MARK: - Returning User

    private(set) var hasReturningUser: Bool = false

    var pendingOnboardingData: BudgetTemplateCreateFromOnboarding? {
        get { onboardingBootstrapper.pendingOnboardingData }
        set { onboardingBootstrapper.setPendingData(newValue) }
    }

    // MARK: - Biometric (delegated to BiometricManager)

    let biometric: BiometricManager
    let enrollmentPolicy: BiometricAutomaticEnrollmentPolicy

    @ObservationIgnored private let authenticatedEntryCoordinator: AuthenticatedEntryCoordinator
    let recoveryFlowCoordinator: RecoveryFlowCoordinator
    @ObservationIgnored private let onboardingBootstrapper: OnboardingBootstrapper

    /// `biometricError` stays on AppState — used for session expiry messages, not just biometric.
    var biometricError: String?

    var biometricEnabled: Bool {
        get { biometric.isEnabled }
        set { biometric.isEnabled = newValue }
    }

    var biometricCredentialsAvailable: Bool {
        get { biometric.credentialsAvailable }
        set { biometric.credentialsAvailable = newValue }
    }

    // MARK: - Recovery Key UI (delegated to RecoveryFlowCoordinator)

    var recoveryFlowState: RecoveryFlowState {
        recoveryFlowCoordinator.recoveryFlowState
    }

    var isRecoveryConsentVisible: Bool {
        get { recoveryFlowCoordinator.isRecoveryConsentVisible }
        set { if !newValue { recoveryFlowCoordinator.setIdle() } }
    }

    var isRecoveryKeySheetVisible: Bool {
        get { recoveryFlowCoordinator.isRecoveryKeySheetVisible }
        set { if !newValue { recoveryFlowCoordinator.setIdle() } }
    }

    var recoveryKeyForPresentation: String? {
        recoveryFlowCoordinator.recoveryKeyForPresentation
    }

    // MARK: - Session Lifecycle (delegated to SessionLifecycleCoordinator)

    @ObservationIgnored private let sessionLifecycleCoordinator: SessionLifecycleCoordinator

    var isRestoringSession: Bool { sessionLifecycleCoordinator.isRestoringSession }

    private var backgroundRefreshTask: Task<Void, Never>?
    private var isLoggingOut = false
    private var returningUserFlagLoaded = false

    // MARK: - Services

    private let authService: AuthService
    private let clientKeyManager: ClientKeyManager
    private let keychainManager: any KeychainEmailStoring
    private let encryptionAPI: EncryptionAPI
    private let postAuthResolver: any PostAuthResolving
    private let validateRegularSession: @Sendable () async throws -> UserInfo?

    // MARK: - Toast

    let toastManager = ToastManager()

    init(dependencies: AppStateDependencies = .default) {
        let deps = dependencies
        self.authService = deps.authService
        self.clientKeyManager = deps.clientKeyManager
        self.keychainManager = deps.keychainManager
        self.encryptionAPI = deps.encryptionAPI
        self.postAuthResolver =
            deps.postAuthResolver ??
            PostAuthResolver(
                vaultStatusProvider: deps.encryptionAPI,
                sessionRefresher: deps.authService,
                clientKeyResolver: deps.clientKeyManager
            )
        self.validateRegularSession =
            deps.validateRegularSession ?? Self.defaultValidateRegularSession(deps.authService)

        self.biometric = BiometricManager(
            preferenceStore: deps.biometricPreferenceStore,
            authService: deps.authService,
            clientKeyManager: deps.clientKeyManager,
            capability: deps.biometricCapability ?? { deps.biometricService.canUseBiometrics() },
            authenticate: deps.biometricAuthenticate ?? { try await deps.biometricService.authenticate() },
            syncCredentials: deps.syncBiometricCredentials
                ?? BiometricManager.defaultSyncCredentials(deps.authService),
            resolveKey: deps.resolveBiometricKey
                ?? BiometricManager.defaultResolveKey(deps.clientKeyManager),
            validateKey: deps.validateBiometricKey
                ?? BiometricManager.defaultValidateKey(deps.encryptionAPI)
        )
        self.enrollmentPolicy = BiometricAutomaticEnrollmentPolicy()
        setupCoordinators(deps)

        Task { @MainActor in
            if !returningUserFlagLoaded {
                hasReturningUser = await keychainManager.getLastUsedEmail() != nil
                returningUserFlagLoaded = true
            }
            await biometric.loadPreference()
        }
    }

    private func setupCoordinators(_ deps: AppStateDependencies) {
        self.authenticatedEntryCoordinator = AuthenticatedEntryCoordinator(
            biometric: self.biometric,
            enrollmentPolicy: self.enrollmentPolicy,
            toastManager: toastManager
        )
        if let setupRecoveryKey = deps.setupRecoveryKey {
            self.recoveryFlowCoordinator = RecoveryFlowCoordinator(
                setupRecoveryKey: setupRecoveryKey,
                toastManager: toastManager
            )
        } else {
            self.recoveryFlowCoordinator = RecoveryFlowCoordinator(
                encryptionAPI: deps.encryptionAPI,
                toastManager: toastManager
            )
        }
        self.onboardingBootstrapper = OnboardingBootstrapper(
            createTemplate: { data in try await TemplateService.shared.createTemplateFromOnboarding(data) },
            createBudget: { data in try await BudgetService.shared.createBudget(data) },
            toastManager: toastManager
        )
        self.sessionLifecycleCoordinator = SessionLifecycleCoordinator(
            biometric: self.biometric,
            clientKeyManager: deps.clientKeyManager,
            validateRegularSession: self.validateRegularSession,
            validateBiometricSession: deps.validateBiometricSession
                ?? Self.defaultValidateBiometricSession(deps.authService),
            nowProvider: deps.nowProvider
        )
    }

    /// Backward-compatible convenience init — delegates to `init(dependencies:)`.
    /// Preserves the existing call-site API used by all tests.
    convenience init(
        authService: AuthService = .shared,
        biometricService: BiometricService = .shared,
        clientKeyManager: ClientKeyManager = .shared,
        keychainManager: any KeychainEmailStoring = KeychainManager.shared,
        encryptionAPI: EncryptionAPI = .shared,
        postAuthResolver: (any PostAuthResolving)? = nil,
        biometricPreferenceStore: BiometricPreferenceStore = BiometricPreferenceStore(),
        biometricCapability: (@Sendable () -> Bool)? = nil,
        biometricAuthenticate: (@Sendable () async throws -> Void)? = nil,
        syncBiometricCredentials: (@Sendable () async -> Bool)? = nil,
        resolveBiometricKey: (@Sendable () async -> String?)? = nil,
        validateBiometricKey: (@Sendable (String) async -> Bool)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        nowProvider: @escaping () -> Date = Date.init
    ) {
        self.init(dependencies: AppStateDependencies(
            authService: authService,
            clientKeyManager: clientKeyManager,
            keychainManager: keychainManager,
            encryptionAPI: encryptionAPI,
            postAuthResolver: postAuthResolver,
            biometricService: biometricService,
            biometricPreferenceStore: biometricPreferenceStore,
            biometricCapability: biometricCapability,
            biometricAuthenticate: biometricAuthenticate,
            syncBiometricCredentials: syncBiometricCredentials,
            resolveBiometricKey: resolveBiometricKey,
            validateBiometricKey: validateBiometricKey,
            validateRegularSession: validateRegularSession,
            validateBiometricSession: validateBiometricSession,
            nowProvider: nowProvider
        ))
    }

    // MARK: - Default Closure Factories

    private static func defaultValidateRegularSession(
        _ authService: AuthService
    ) -> @Sendable () async throws -> UserInfo? {
        {
            try await authService.validateSession()
        }
    }

    private static func defaultValidateBiometricSession(
        _ authService: AuthService
    ) -> @Sendable () async throws -> BiometricSessionResult? {
        {
            try await authService.validateBiometricSession()
        }
    }

    // MARK: - Biometric Proxy Methods

    @discardableResult
    func enableBiometric() async -> Bool {
        await biometric.enable(source: .manual, reason: "account_settings")
    }

    func disableBiometric() async {
        await biometric.disable()
    }

    func attemptBiometricUnlock() async -> Bool {
        await biometric.attemptUnlock()
    }

    // MARK: - Reinstall Detection

    private func clearKeychainIfReinstalled() async {
        let key = UserDefaultsKey.hasLaunchedBefore
        guard !UserDefaults.standard.bool(forKey: key) else { return }

        Logger.auth.info("First launch detected — clearing stale keychain data")
        await keychainManager.clearAllData()

        // Reset in-memory state
        biometric.hydrate(false)
        hasReturningUser = false
        returningUserFlagLoaded = true
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()

        UserDefaults.standard.set(true, forKey: key)
    }

    // MARK: - Actions

    private func authDebug(_ code: String, _ message: String) {
        #if DEBUG
        Logger.auth.debug("[\(code, privacy: .public)] \(message, privacy: .public)")
        #endif
    }

    func enterSignupFlow() {
        OnboardingState.clearPersistedData()
        onboardingBootstrapper.clearPendingData()
        hasReturningUser = false
        returningUserFlagLoaded = true
    }

    func checkAuthState() async {
        authDebug("AUTH_COLD_START_BEGIN", "checkAuthState")

        // Detect reinstall: UserDefaults is cleared on uninstall, Keychain is not
        await clearKeychainIfReinstalled()

        authState = .loading
        biometricError = nil
        await biometric.loadPreference()
        authDebug("AUTH_COLD_START_PREF", "biometricEnabled=\(biometric.isEnabled)")

        // Cold start: clear session clientKey so a stale key in keychain
        // can't bypass FaceID/PIN. Biometric keychain is preserved.
        await clientKeyManager.clearSession()

        let manualBiometricRetryRequired = UserDefaults.standard.bool(
            forKey: UserDefaultsKey.manualBiometricRetryRequired
        )

        if manualBiometricRetryRequired {
            authDebug("AUTH_COLD_START_BRANCH", "manual_retry_required")
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
            return
        }

        // 1. Biometric: Face ID -> PIN/dashboard (skip if user explicitly logged out)
        let didExplicitLogout = UserDefaults.standard.bool(forKey: UserDefaultsKey.didExplicitLogout)

        if biometric.isEnabled && !didExplicitLogout {
            authDebug("AUTH_COLD_START_BRANCH", "biometric")
            await applyColdStartResult(
                sessionLifecycleCoordinator.attemptBiometricSessionValidation()
            )
            return
        }

        authDebug("AUTH_COLD_START_BRANCH", "regular")

        // 2. Session valid -> PIN entry (keeps user logged in without biometric)
        let result = await sessionLifecycleCoordinator.attemptRegularSessionValidation()
        await applyColdStartResult(result)
    }

    private func applyColdStartResult(_ result: SessionLifecycleCoordinator.ColdStartResult) async {
        switch result {
        case .biometricAuthenticated(let user, _):
            currentUser = user
            await resolvePostAuth(user: user)
        case .regularSession(let user):
            await resolvePostAuth(user: user)
        case .unauthenticated:
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        case .networkError(let message):
            biometricError = message
            authState = .unauthenticated
        case .biometricSessionExpired:
            biometricError = "Ta session a expir\u{00E9}, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        }
    }

    /// After Supabase session is valid, route deterministically to setup/entry/app.
    func resolvePostAuth(user: UserInfo) async {
        currentUser = user
        authState = .loading

        let destination = await postAuthResolver.resolve()

        switch destination {
        case .needsPinSetup:
            authDebug("AUTH_POST_AUTH_DEST", "needsPinSetup")
            recoveryFlowCoordinator.reset()
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "needsPinEntry")
            recoveryFlowCoordinator.setPendingConsent(needsRecoveryConsent)
            authState = .needsPinEntry
        case .authenticated(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "authenticated")
            recoveryFlowCoordinator.setPendingConsent(false)
            if needsRecoveryConsent {
                recoveryFlowCoordinator.setConsentPrompt()
            } else {
                recoveryFlowCoordinator.setIdle()
            }
            await enterAuthenticated(context: .directAuthenticated)
        case .unauthenticatedSessionExpired:
            authDebug("AUTH_POST_AUTH_DEST", "unauthenticatedSessionExpired")
            recoveryFlowCoordinator.reset()
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        case .vaultCheckFailed:
            authDebug("AUTH_POST_AUTH_DEST", "vaultCheckFailed")
            // Safe fallback for existing users: assume PIN entry.
            recoveryFlowCoordinator.reset()
            authState = .needsPinEntry
        }
    }

    private func transitionToAuthenticated() async {
        authState = .authenticated
        await authenticatedEntryCoordinator.syncCredentials()
    }

    private func enterAuthenticated(context: AuthCompletionContext) async {
        await transitionToAuthenticated()
        await authenticatedEntryCoordinator.runEnrollmentPipeline(
            context: context,
            hasActiveModal: recoveryFlowCoordinator.isModalActive
        )
    }

    // MARK: - Background Lock

    func handleEnterBackground() {
        sessionLifecycleCoordinator.handleEnterBackground()
    }

    func prepareForForeground() {
        sessionLifecycleCoordinator.prepareForForeground(authState: authState)
    }

    func resetTips() {
        ProductTips.resetAllTips()
    }

    // MARK: - Stale Client Key

    func handleStaleClientKey() async {
        guard !isLoggingOut, authState == .authenticated else { return }
        await clientKeyManager.clearAll()
        authState = .needsPinEntry
    }

    // MARK: - Session Expiry

    /// Called when APIClient detects an unrecoverable 401. AuthService.logout() was already
    /// called by APIClient — this method only resets local UI state.
    func handleSessionExpired() async {
        guard !isLoggingOut else { return }
        await clientKeyManager.clearSession()
        resetSession(.sessionExpiry)
    }

    // MARK: - Maintenance Actions

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
    }

    // MARK: - Returning User Flag

    private func ensureReturningUserFlagLoaded() async {
        guard !returningUserFlagLoaded else { return }
        hasReturningUser = await keychainManager.getLastUsedEmail() != nil
        returningUserFlagLoaded = true
    }
}

// MARK: - Foreground & Background

extension AppState {
    func handleEnterForeground() async {
        defer { sessionLifecycleCoordinator.clearRestoringSession() }

        let result = await sessionLifecycleCoordinator.handleEnterForeground(authState: authState)

        switch result {
        case .noLockNeeded:
            break
        case .biometricUnlockSuccess:
            // Refresh Supabase session in background — token may have expired
            // during long background periods. Non-blocking: user sees the app
            // immediately, session refresh happens concurrently.
            backgroundRefreshTask?.cancel()
            let validate = validateRegularSession
            backgroundRefreshTask = Task { [weak self] in
                defer { Task { @MainActor [weak self] in self?.backgroundRefreshTask = nil } }
                do {
                    _ = try await validate()
                } catch {
                    guard !Task.isCancelled else { return }
                    Logger.auth.warning(
                        "handleEnterForeground: session refresh failed - \(error)"
                    )
                    await self?.logout(source: .system)
                }
            }
        case .lockRequired, .staleKeyLockRequired:
            authState = .needsPinEntry
        }
    }
}

// MARK: - Auth (Login, Logout, Password Reset)

extension AppState {
    func login(email: String, password: String) async throws {
        // NOTE: Do NOT set authState = .loading here.
        // LoginView handles its own loading state. Setting authState = .loading
        // would cause SwiftUI to unmount LoginView (showing LoadingView), then
        // remount it on error — causing a jarring close/reopen animation.

        let user = try await authService.login(email: email, password: password)
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
        await keychainManager.saveLastUsedEmail(email)
        hasReturningUser = true
        returningUserFlagLoaded = true
        await resolvePostAuth(user: user)
    }

    func loginWithBiometric() async {
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
        await applyColdStartResult(
            sessionLifecycleCoordinator.attemptBiometricSessionValidation()
        )
    }

    func logout(source: LogoutSource = .userInitiated) async {
        guard !isLoggingOut else { return }
        isLoggingOut = true
        defer { isLoggingOut = false }

        backgroundRefreshTask?.cancel()
        backgroundRefreshTask = nil

        switch source {
        case .userInitiated:
            UserDefaults.standard.set(true, forKey: UserDefaultsKey.didExplicitLogout)
        case .system:
            clearExplicitLogoutFlag()
        }

        if biometric.isEnabled {
            // Refresh biometric tokens with the latest session before clearing
            var biometricTokensSaved = false
            do {
                try await authService.saveBiometricTokens()
                biometricTokensSaved = true
            } catch {
                Logger.auth.warning("logout: SDK session unavailable, falling back to keychain - \(error)")
                biometricTokensSaved = await authService.saveBiometricTokensFromKeychain()
            }

            if biometricTokensSaved {
                // Clear local SDK state WITHOUT calling /logout (would revoke the refresh token)
                await authService.logoutKeepingBiometricSession()
            } else {
                // Both save attempts failed — biometric tokens are unusable.
                // Do a full logout instead of silently losing Face ID.
                Logger.auth.error("logout: biometric token preservation failed, doing full logout")
                await authService.logout()
                biometric.isEnabled = false
            }
        } else {
            await authService.logout()
        }

        await clientKeyManager.clearSession()
        resetSession(source == .userInitiated ? .userLogout : .systemLogout)
    }

    /// Complete password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen.
    func completePasswordResetFlow() async {
        await authService.logout()
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometric.isEnabled = false
        resetSession(.passwordReset)
        toastManager.show("Mot de passe réinitialisé, reconnecte-toi", type: .success)
    }

    /// Cancel password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen without success feedback.
    func cancelPasswordResetFlow() async {
        await authService.logout()
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometric.isEnabled = false
        resetSession(.passwordReset)
    }

    func deleteAccount() async {
        do {
            _ = try await authService.deleteAccount()
        } catch {
            toastManager.show("La suppression du compte a échoué", type: .error)
            return
        }

        await keychainManager.clearLastUsedEmail()
        hasReturningUser = false
        returningUserFlagLoaded = true
        OnboardingState.clearPersistedData()
        onboardingBootstrapper.clearPendingData()
        clearManualBiometricRetryRequiredFlag()
        await logout(source: .system)
    }

    // MARK: - Session Reset

    private enum SessionResetScope {
        case userLogout
        case systemLogout
        case sessionExpiry
        case recoverySessionExpiry
        case passwordReset

        var clearsUIState: Bool {
            switch self {
            case .sessionExpiry: false
            default: true
            }
        }

        var clearsNavigation: Bool {
            switch self {
            case .userLogout, .systemLogout, .passwordReset: true
            default: false
            }
        }

        var clearsPostAuthError: Bool {
            switch self {
            case .userLogout, .systemLogout: true
            default: false
            }
        }

        var errorMessage: String? {
            switch self {
            case .sessionExpiry, .recoverySessionExpiry: "Ta session a expiré, reconnecte-toi"
            default: nil
            }
        }

        var setsManualBiometricRetry: Bool { self == .recoverySessionExpiry }
    }

    private func resetSession(_ scope: SessionResetScope) {
        currentUser = nil
        authState = .unauthenticated
        biometricError = scope.errorMessage

        if scope.clearsUIState {
            recoveryFlowCoordinator.reset()
            enrollmentPolicy.resetForNewTransition()
        }
        if scope.clearsPostAuthError { showPostAuthError = false }
        if scope.clearsNavigation {
            budgetPath = NavigationPath()
            templatePath = NavigationPath()
            selectedTab = .currentMonth
            WidgetDataCoordinator().clear()
            WidgetCenter.shared.reloadAllTimelines()
        }
        if scope.setsManualBiometricRetry {
            setManualBiometricRetryRequiredFlag(true)
        }
    }

    // MARK: - UserDefaults Helpers

    private func clearExplicitLogoutFlag() {
        UserDefaults.standard.removeObject(forKey: UserDefaultsKey.didExplicitLogout)
    }

    private func setManualBiometricRetryRequiredFlag(_ required: Bool) {
        UserDefaults.standard.set(required, forKey: UserDefaultsKey.manualBiometricRetryRequired)
    }

    private func clearManualBiometricRetryRequiredFlag() {
        UserDefaults.standard.removeObject(forKey: UserDefaultsKey.manualBiometricRetryRequired)
    }
}

// MARK: - Maintenance

extension AppState {
    func checkMaintenanceStatus() async {
        do {
            isNetworkUnavailable = false
            isInMaintenance = try await MaintenanceService.shared.checkStatus()
        } catch {
            // Distinguish network errors from server errors:
            // network unreachable → dedicated screen with retry
            // server error → assume maintenance (fail-closed)
            if (error as? URLError) != nil {
                isNetworkUnavailable = true
                isInMaintenance = false
            } else {
                isInMaintenance = true
            }
        }
    }

    func retryNetworkCheck() async {
        await checkMaintenanceStatus()
        if !isInMaintenance, !isNetworkUnavailable {
            await checkAuthState()
        }
    }
}

// MARK: - Onboarding & PIN

extension AppState {
    func completeOnboarding(user: UserInfo, onboardingData: BudgetTemplateCreateFromOnboarding) async {
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
        currentUser = user
        await keychainManager.saveLastUsedEmail(user.email)
        hasReturningUser = true
        returningUserFlagLoaded = true
        onboardingBootstrapper.setPendingData(onboardingData)
        authState = .loading

        // Route based on actual vault status.
        // Handles reused emails where encryption keys already exist.
        let destination = await postAuthResolver.resolve()
        handleOnboardingDestination(destination)
    }

    func retryOnboardingPostAuth() async {
        showPostAuthError = false
        let destination = await postAuthResolver.resolve()
        handleOnboardingDestination(destination)
    }

    private func handleOnboardingDestination(_ destination: PostAuthDestination) {
        switch destination {
        case .needsPinSetup:
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            recoveryFlowCoordinator.setPendingConsent(needsRecoveryConsent)
            authState = .needsPinEntry
        case .authenticated:
            // Vault fully configured — verify existing PIN
            authState = .needsPinEntry
        case .unauthenticatedSessionExpired, .vaultCheckFailed:
            showPostAuthError = true
        }
    }

    func completePinSetup() async {
        guard authState == .needsPinSetup else { return }

        await onboardingBootstrapper.bootstrapIfNeeded()
        await enterAuthenticated(context: .pinSetup)
    }

    func completePinEntry() async {
        guard authState == .needsPinEntry else { return }

        if recoveryFlowCoordinator.showConsentPromptIfPending() {
            return
        }

        await enterAuthenticated(context: .pinEntry)
    }

    func startRecovery() {
        setManualBiometricRetryRequiredFlag(true)
        authState = .needsPinRecovery
    }

    func completeRecovery() async {
        guard authState == .needsPinRecovery else { return }
        clearManualBiometricRetryRequiredFlag()
        await enterAuthenticated(context: .pinRecovery)
    }

    func cancelRecovery() {
        clearManualBiometricRetryRequiredFlag()
        authState = .needsPinEntry
    }

    func handleRecoverySessionExpired() async {
        guard !isLoggingOut else { return }
        await clientKeyManager.clearSession()
        resetSession(.recoverySessionExpiry)
    }

    func acceptRecoveryKeyRepairConsent() async {
        let result = await recoveryFlowCoordinator.acceptConsent()
        switch result {
        case .keyGenerated:
            break
        case .conflict:
            await enterAuthenticated(context: .recoveryKeyConflict)
        case .error:
            await enterAuthenticated(context: .recoveryKeyError)
        }
    }

    func declineRecoveryKeyRepairConsent() async {
        recoveryFlowCoordinator.declineConsent()
        await enterAuthenticated(context: .recoveryKeyDeclined)
    }

    func completePostAuthRecoveryKeyPresentation() async {
        recoveryFlowCoordinator.completePresentationDismissal()
        await enterAuthenticated(context: .recoveryKeyPresented)
    }
}

// MARK: - Tab

enum Tab: String, CaseIterable, Identifiable {
    case currentMonth = "current-month"
    case budgets = "budgets"
    case templates = "templates"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .currentMonth: "Accueil"
        case .budgets: "Budgets"
        case .templates: "Modèles"
        }
    }

    var icon: String {
        switch self {
        case .currentMonth: "house"
        case .budgets: "calendar"
        case .templates: "doc.text"
        }
    }

    var index: Int {
        Self.allCases.firstIndex(of: self) ?? 0
    }
}

// MARK: - Navigation Destinations

enum BudgetDestination: Hashable {
    case details(budgetId: String)
}

enum TemplateDestination: Hashable {
    case details(templateId: String)
}
