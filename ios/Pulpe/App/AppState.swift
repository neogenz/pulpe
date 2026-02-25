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

    var pendingOnboardingData: BudgetTemplateCreateFromOnboarding?

    // MARK: - Biometric (delegated to BiometricManager)

    let biometric: BiometricManager
    let enrollmentPolicy: BiometricAutomaticEnrollmentPolicy

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

    // MARK: - Recovery Key UI

    private(set) var recoveryFlowState: RecoveryFlowState = .idle

    var isRecoveryConsentVisible: Bool {
        get { recoveryFlowState == .consentPrompt }
        set { if !newValue { recoveryFlowState = .idle } }
    }

    var isRecoveryKeySheetVisible: Bool {
        get {
            if case .presentingKey = recoveryFlowState { return true }
            return false
        }
        set { if !newValue { recoveryFlowState = .idle } }
    }

    var recoveryKeyForPresentation: String? {
        if case .presentingKey(let key) = recoveryFlowState { return key }
        return nil
    }

    // MARK: Pending recovery consent (set during PIN entry, shown on completion)
    private var pendingRecoveryConsent = false

    // MARK: - Background Grace Period

    private(set) var isRestoringSession = false
    private var backgroundDate: Date?
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
    private let validateBiometricSession: @Sendable () async throws -> BiometricSessionResult?
    private let nowProvider: () -> Date

    // MARK: - Toast

    let toastManager = ToastManager()

    init(
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
        self.authService = authService
        self.clientKeyManager = clientKeyManager
        self.keychainManager = keychainManager
        self.encryptionAPI = encryptionAPI
        self.postAuthResolver =
            postAuthResolver ??
            PostAuthResolver(
                vaultStatusProvider: encryptionAPI,
                sessionRefresher: authService,
                clientKeyResolver: clientKeyManager
            )
        self.nowProvider = nowProvider
        self.validateRegularSession =
            validateRegularSession ?? Self.defaultValidateRegularSession(authService)
        self.validateBiometricSession =
            validateBiometricSession ?? Self.defaultValidateBiometricSession(authService)

        self.biometric = BiometricManager(
            preferenceStore: biometricPreferenceStore,
            authService: authService,
            clientKeyManager: clientKeyManager,
            capability: biometricCapability ?? { biometricService.canUseBiometrics() },
            authenticate: biometricAuthenticate ?? { try await biometricService.authenticate() },
            syncCredentials: syncBiometricCredentials ?? BiometricManager.defaultSyncCredentials(authService),
            resolveKey: resolveBiometricKey ?? BiometricManager.defaultResolveKey(clientKeyManager),
            validateKey: validateBiometricKey ?? BiometricManager.defaultValidateKey(encryptionAPI)
        )
        self.enrollmentPolicy = BiometricAutomaticEnrollmentPolicy()

        // Eagerly start loading persisted values so they may be ready before checkAuthState() runs.
        // SAFETY: No race with checkAuthState() — both paths use idempotent "ensure" methods
        // guarded by `returningUserFlagLoaded` and `biometricPreferenceLoaded` flags.
        // If this Task completes first, checkAuthState() skips the loads; if checkAuthState()
        // runs first, this Task's loads become no-ops.
        Task { @MainActor in
            if !returningUserFlagLoaded {
                hasReturningUser = await keychainManager.getLastUsedEmail() != nil
                returningUserFlagLoaded = true
            }
            await biometric.loadPreference()
        }
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

    private func fallbackToRegularSessionAfterBiometricFailure(reason: String) async {
        authDebug("AUTH_COLD_START_REGULAR_FALLBACK", "reason=\(reason)")
        do {
            if let user = try await validateRegularSession() {
                authDebug("AUTH_COLD_START_REGULAR_VALID", "reason=\(reason)")
                await resolvePostAuth(user: user)
            } else {
                authDebug("AUTH_COLD_START_REGULAR_MISSING", "reason=\(reason)")
                await ensureReturningUserFlagLoaded()
                authState = .unauthenticated
            }
        } catch {
            Logger.auth.warning("checkAuthState: regular session fallback failed - \(error)")
            authDebug("AUTH_COLD_START_REGULAR_ERROR", "reason=\(reason)")
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        }
    }

    func enterSignupFlow() {
        OnboardingState.clearPersistedData()
        pendingOnboardingData = nil
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

        // 1. Biometric: Face ID → PIN/dashboard (skip if user explicitly logged out)
        let didExplicitLogout = UserDefaults.standard.bool(forKey: UserDefaultsKey.didExplicitLogout)

        if biometric.isEnabled && !didExplicitLogout {
            authDebug("AUTH_COLD_START_BRANCH", "biometric")
            await attemptBiometricSessionValidation()
            return
        }

        authDebug("AUTH_COLD_START_BRANCH", "regular")

        // 2. Session valid → PIN entry (keeps user logged in without biometric)
        do {
            if let user = try await validateRegularSession() {
                authDebug("AUTH_COLD_START_REGULAR_VALID", "source=checkAuthState")
                await resolvePostAuth(user: user)
                return
            }
        } catch {
            Logger.auth.warning("checkAuthState: regular session validation failed - \(error)")
            authDebug("AUTH_COLD_START_REGULAR_ERROR", "source=checkAuthState")
        }

        // 3. No valid session → login or onboarding
        authDebug("AUTH_COLD_START_REGULAR_MISSING", "source=checkAuthState")
        await ensureReturningUserFlagLoaded()
        authState = .unauthenticated
    }

    private func attemptBiometricSessionValidation() async {
        authDebug("AUTH_BIO_VALIDATE_START", "attemptBiometricSessionValidation")
        do {
            if let result = try await validateBiometricSession() {
                currentUser = result.user
                if let clientKeyHex = result.clientKeyHex {
                    if await biometric.validateKey(clientKeyHex) {
                        await clientKeyManager.store(clientKeyHex, enableBiometric: false)
                    } else {
                        Logger.auth.warning("attemptBiometricSessionValidation: stale biometric key, clearing")
                        await biometric.handleStaleKey()
                    }
                }
                authDebug("AUTH_BIO_VALIDATE_RESULT", "success")
                await resolvePostAuth(user: result.user)
            } else {
                // No tokens found
                authDebug("AUTH_BIO_VALIDATE_RESULT", "no_tokens")
                await fallbackToRegularSessionAfterBiometricFailure(reason: "no_tokens")
            }
        } catch let error as KeychainError {
            switch error {
            case .userCanceled:
                authDebug("AUTH_BIO_VALIDATE_RESULT", "user_cancel")
            case .authFailed:
                authDebug("AUTH_BIO_VALIDATE_RESULT", "auth_failed")
            default:
                authDebug("AUTH_BIO_VALIDATE_RESULT", "auth_failed")
            }
            await fallbackToRegularSessionAfterBiometricFailure(reason: "keychain_error")
        } catch let error as URLError {
            // Network error — keep tokens and biometric enabled for retry
            Logger.auth.warning("checkAuthState: network error during biometric login - \(error)")
            authDebug("AUTH_BIO_VALIDATE_RESULT", "network")
            biometricError = "Connexion impossible, réessaie"
            authState = .unauthenticated
        } catch let error as AuthServiceError {
            Logger.auth.error("checkAuthState: biometric session refresh failed - \(error)")
            await handleBiometricSessionExpired()
        } catch {
            Logger.auth.error("checkAuthState: unknown error during biometric login - \(error)")
            await handleBiometricSessionExpired()
        }
    }

    private func handleBiometricSessionExpired() async {
        await biometric.handleSessionExpired()
        authDebug("AUTH_BIO_VALIDATE_RESULT", "session_expired")
        biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
        authState = .unauthenticated
    }

    /// After Supabase session is valid, route deterministically to setup/entry/app.
    func resolvePostAuth(user: UserInfo) async {
        currentUser = user
        authState = .loading

        let destination = await postAuthResolver.resolve()

        switch destination {
        case .needsPinSetup:
            authDebug("AUTH_POST_AUTH_DEST", "needsPinSetup")
            recoveryFlowState = .idle
            pendingRecoveryConsent = false
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "needsPinEntry")
            pendingRecoveryConsent = needsRecoveryConsent
            authState = .needsPinEntry
        case .authenticated(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "authenticated")
            pendingRecoveryConsent = false
            if needsRecoveryConsent {
                recoveryFlowState = .consentPrompt
            } else {
                recoveryFlowState = .idle
            }
            await enterAuthenticated(context: .directAuthenticated)
        case .unauthenticatedSessionExpired:
            authDebug("AUTH_POST_AUTH_DEST", "unauthenticatedSessionExpired")
            recoveryFlowState = .idle
            pendingRecoveryConsent = false
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        case .vaultCheckFailed:
            authDebug("AUTH_POST_AUTH_DEST", "vaultCheckFailed")
            // Safe fallback for existing users: assume PIN entry.
            recoveryFlowState = .idle
            pendingRecoveryConsent = false
            authState = .needsPinEntry
        }
    }

    private func transitionToAuthenticated() async {
        authState = .authenticated

        let syncOK = await biometric.syncAfterAuth()
        if !syncOK {
            toastManager.show(
                "La reconnaissance biométrique n'a pas pu être activée",
                type: .error
            )
        }
    }

    private func enterAuthenticated(context: AuthCompletionContext) async {
        await transitionToAuthenticated()
        enrollmentPolicy.resetForNewTransition()
        let decision = enrollmentPolicy.shouldAttempt(
            biometricEnabled: biometric.isEnabled,
            biometricCapable: biometric.canEnroll(),
            isAuthenticated: authState == .authenticated,
            sourceEligible: context.allowsAutomaticEnrollment,
            hasActiveModal: recoveryFlowState.isModalActive,
            context: context.reason
        )
        switch decision {
        case .proceed:
            enrollmentPolicy.markInFlight(context: context.reason)
            let enabled = await biometric.enable(source: .automatic, reason: context.reason)
            enrollmentPolicy.markComplete(context: context.reason, outcome: enabled ? .success : .deniedOrFailed)
        case .skip:
            break
        }
    }

    // MARK: - Background Lock

    private var isBackgroundLockRequired: Bool {
        guard let bgDate = backgroundDate else { return false }
        let elapsed = Duration.seconds(nowProvider().timeIntervalSince(bgDate))
        return elapsed >= AppConfiguration.backgroundGracePeriod
            && authState == .authenticated
    }

    func handleEnterBackground() {
        backgroundDate = nowProvider()
    }

    func prepareForForeground() {
        guard isBackgroundLockRequired else { return }
        isRestoringSession = true
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
        defer { isRestoringSession = false }

        guard isBackgroundLockRequired else { return }
        backgroundDate = nil

        await clientKeyManager.clearCache()

        // Try biometric before routing to PIN entry — avoids PinEntryView flash
        if biometric.isEnabled, let clientKeyHex = await biometric.resolveKey() {
            if await biometric.validateKey(clientKeyHex) {
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
                return
            }
            Logger.auth.warning("handleEnterForeground: stale biometric key, requiring PIN")
            await biometric.handleStaleKey()
        }

        // Biometric unavailable/failed/cancelled — require PIN
        authState = .needsPinEntry
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
        await attemptBiometricSessionValidation()
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
        pendingOnboardingData = nil
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
            recoveryFlowState = .idle
            pendingRecoveryConsent = false
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
        pendingOnboardingData = onboardingData
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
            pendingRecoveryConsent = needsRecoveryConsent
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

        // If we have pending onboarding data, create template and budget
        if let onboardingData = pendingOnboardingData {
            do {
                // Create template from onboarding data
                let template = try await TemplateService.shared.createTemplateFromOnboarding(onboardingData)

                // Create initial budget for current month
                let now = Date()
                let budgetData = BudgetCreate(
                    month: now.month,
                    year: now.year,
                    description: now.monthYearFormatted,
                    templateId: template.id
                )
                _ = try await BudgetService.shared.createBudget(budgetData)

                // Clear pending data
                pendingOnboardingData = nil
            } catch {
                Logger.auth.error("completePinSetup: failed to create template/budget - \(error)")
                toastManager.show("Erreur lors de la création du budget", type: .error)
            }
        }

        await enterAuthenticated(context: .pinSetup)
    }

    func completePinEntry() async {
        guard authState == .needsPinEntry else { return }

        if pendingRecoveryConsent {
            recoveryFlowState = .consentPrompt
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
        recoveryFlowState = .generatingKey
        pendingRecoveryConsent = false

        do {
            let recoveryKey = try await encryptionAPI.setupRecoveryKey()
            recoveryFlowState = .presentingKey(recoveryKey)
        } catch let error as APIError {
            if case .conflict = error {
                Logger.auth.info("acceptRecoveryKeyRepairConsent: recovery key already exists, continue")
                recoveryFlowState = .idle
                await enterAuthenticated(context: .recoveryKeyConflict)
                return
            }

            Logger.auth.error("acceptRecoveryKeyRepairConsent: setup-recovery failed - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            recoveryFlowState = .idle
            await enterAuthenticated(context: .recoveryKeyError)
        } catch {
            Logger.auth.error("acceptRecoveryKeyRepairConsent: unexpected setup-recovery error - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            recoveryFlowState = .idle
            await enterAuthenticated(context: .recoveryKeyError)
        }
    }

    func declineRecoveryKeyRepairConsent() async {
        recoveryFlowState = .idle
        pendingRecoveryConsent = false
        await enterAuthenticated(context: .recoveryKeyDeclined)
    }

    func completePostAuthRecoveryKeyPresentation() async {
        recoveryFlowState = .idle
        pendingRecoveryConsent = false
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
