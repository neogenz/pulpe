// swiftlint:disable file_length type_body_length
import OSLog
import SwiftUI
import WidgetKit

@Observable @MainActor
final class AppState {
    // MARK: - UserDefaults Keys

    private enum UserDefaultsKey {
        static let hasLaunchedBefore = "pulpe-has-launched-before"
        static let biometricEnrollmentDismissed = "pulpe-biometric-enrollment-dismissed"
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

    // MARK: - Biometric

    var biometricEnabled: Bool = false {
        didSet {
            guard !isHydratingBiometricPreference else { return }
            biometricSaveTask?.cancel()
            biometricSaveTask = Task {
                await biometricPreferenceStore.save(biometricEnabled)
            }
        }
    }

    var showBiometricEnrollment = false
    var biometricError: String?
    var showRecoveryKeyRepairConsent = false
    var biometricCredentialsAvailable = true

    private var biometricEnrollmentDismissed: Bool {
        UserDefaults.standard.bool(forKey: UserDefaultsKey.biometricEnrollmentDismissed)
    }
    var showPostAuthRecoveryKeySheet = false
    private(set) var needsRecoveryKeyRepairConsent = false
    private(set) var postAuthRecoveryKey: String?

    // MARK: - Background Grace Period

    private(set) var isRestoringSession = false
    private var backgroundDate: Date?
    private var biometricSaveTask: Task<Void, Never>?
    private var biometricPreferenceLoaded = false
    private var isHydratingBiometricPreference = false
    private var returningUserFlagLoaded = false

    // MARK: - Services

    private let authService: AuthService
    private let clientKeyManager: ClientKeyManager
    private let keychainManager: KeychainManager
    private let encryptionAPI: EncryptionAPI
    private let postAuthResolver: any PostAuthResolving
    private let biometricPreferenceStore: BiometricPreferenceStore
    private let biometricCapability: @Sendable () -> Bool
    private let biometricAuthenticate: @Sendable () async throws -> Void
    private let syncBiometricCredentials: @Sendable () async -> Bool
    private let resolveBiometricKey: @Sendable () async -> String?
    private let validateBiometricKey: @Sendable (String) async -> Bool
    private let validateRegularSession: @Sendable () async throws -> UserInfo?
    private let validateBiometricSession: @Sendable () async throws -> BiometricSessionResult?
    private let nowProvider: () -> Date

    // MARK: - Toast

    let toastManager = ToastManager()

    init(
        authService: AuthService = .shared,
        biometricService: BiometricService = .shared,
        clientKeyManager: ClientKeyManager = .shared,
        keychainManager: KeychainManager = .shared,
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
        self.biometricPreferenceStore = biometricPreferenceStore
        self.postAuthResolver =
            postAuthResolver ??
            PostAuthResolver(
                vaultStatusProvider: encryptionAPI,
                sessionRefresher: authService,
                clientKeyResolver: clientKeyManager
            )
        self.nowProvider = nowProvider
        self.biometricCapability = biometricCapability ?? { biometricService.canUseBiometrics() }
        self.biometricAuthenticate = biometricAuthenticate ?? { try await biometricService.authenticate() }
        self.syncBiometricCredentials =
            syncBiometricCredentials ?? Self.defaultSyncBiometricCredentials(authService)
        self.resolveBiometricKey =
            resolveBiometricKey ?? Self.defaultResolveBiometricKey(clientKeyManager)
        self.validateBiometricKey =
            validateBiometricKey ?? Self.defaultValidateBiometricKey(encryptionAPI)
        self.validateRegularSession =
            validateRegularSession ?? Self.defaultValidateRegularSession(authService)
        self.validateBiometricSession =
            validateBiometricSession ?? Self.defaultValidateBiometricSession(authService)

        // Load persisted values asynchronously
        Task { @MainActor in
            if !returningUserFlagLoaded {
                hasReturningUser = await keychainManager.getLastUsedEmail() != nil
                returningUserFlagLoaded = true
            }
            await ensureBiometricPreferenceLoaded()
        }
    }

    // MARK: - Default Closure Factories

    private static func defaultSyncBiometricCredentials(
        _ authService: AuthService
    ) -> @Sendable () async -> Bool {
        {
            do {
                try await authService.saveBiometricTokens()
                return true
            } catch {
                Logger.auth.warning(
                    "transitionToAuthenticated: saveBiometricTokens failed, trying fallback - \(error)"
                )
                let saved = await authService.saveBiometricTokensFromKeychain()
                if !saved {
                    Logger.auth.error("transitionToAuthenticated: biometric token persistence failed")
                }
                return saved
            }
        }
    }

    private static func defaultResolveBiometricKey(
        _ clientKeyManager: ClientKeyManager
    ) -> @Sendable () async -> String? {
        { [clientKeyManager] in
            do {
                return try await clientKeyManager.resolveViaBiometric()
            } catch {
                Logger.auth.debug("Biometric foreground unlock failed: \(error.localizedDescription)")
                return nil
            }
        }
    }

    private static func defaultValidateBiometricKey(
        _ encryptionAPI: EncryptionAPI
    ) -> @Sendable (String) async -> Bool {
        { [encryptionAPI] clientKeyHex in
            do {
                try await encryptionAPI.validateKey(clientKeyHex)
                return true
            } catch is URLError {
                Logger.auth.info("Biometric key validation skipped (network unavailable)")
                return true
            } catch {
                Logger.auth.warning("Biometric client key validation failed: \(error.localizedDescription)")
                return false
            }
        }
    }

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

    // MARK: - Reinstall Detection

    private func clearKeychainIfReinstalled() async {
        let key = UserDefaultsKey.hasLaunchedBefore
        guard !UserDefaults.standard.bool(forKey: key) else { return }

        Logger.auth.info("First launch detected — clearing stale keychain data")
        await keychainManager.clearAllData()

        // Reset in-memory state
        isHydratingBiometricPreference = true
        biometricEnabled = false
        isHydratingBiometricPreference = false
        hasReturningUser = false
        returningUserFlagLoaded = true

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
        hasReturningUser = false
        returningUserFlagLoaded = true
    }

    func checkAuthState() async {
        authDebug("AUTH_COLD_START_BEGIN", "checkAuthState")

        // Detect reinstall: UserDefaults is cleared on uninstall, Keychain is not
        await clearKeychainIfReinstalled()

        authState = .loading
        biometricError = nil
        await ensureBiometricPreferenceLoaded()
        authDebug("AUTH_COLD_START_PREF", "biometricEnabled=\(biometricEnabled)")

        // Cold start: clear session clientKey so a stale key in keychain
        // can't bypass FaceID/PIN. Biometric keychain is preserved.
        await clientKeyManager.clearSession()

        // 1. Biometric: Face ID → PIN/dashboard
        if biometricEnabled {
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
                    if await validateBiometricKey(clientKeyHex) {
                        await clientKeyManager.store(clientKeyHex, enableBiometric: false)
                    } else {
                        Logger.auth.warning("attemptBiometricSessionValidation: stale biometric key, clearing")
                        await clientKeyManager.clearAll()
                        biometricEnabled = false
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
        await clientKeyManager.clearAll()
        await authService.clearBiometricTokens()
        biometricCredentialsAvailable = false
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
            needsRecoveryKeyRepairConsent = false
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "needsPinEntry")
            needsRecoveryKeyRepairConsent = needsRecoveryConsent
            authState = .needsPinEntry
        case .authenticated(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "authenticated")
            needsRecoveryKeyRepairConsent = needsRecoveryConsent
            if needsRecoveryConsent {
                await transitionToAuthenticated(allowBiometricPrompt: false)
                showBiometricEnrollment = false
                showRecoveryKeyRepairConsent = true
            } else {
                await transitionToAuthenticated()
            }
        case .unauthenticatedSessionExpired:
            authDebug("AUTH_POST_AUTH_DEST", "unauthenticatedSessionExpired")
            needsRecoveryKeyRepairConsent = false
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        case .vaultCheckFailed:
            authDebug("AUTH_POST_AUTH_DEST", "vaultCheckFailed")
            // Safe fallback for existing users: assume PIN entry.
            needsRecoveryKeyRepairConsent = false
            authState = .needsPinEntry
        }
    }

    private func transitionToAuthenticated(allowBiometricPrompt: Bool = true) async {
        authState = .authenticated

        if biometricEnabled {
            let tokensReady = await syncBiometricCredentials()
            let keyReady = await clientKeyManager.enableBiometric()
            if tokensReady && keyReady {
                biometricCredentialsAvailable = true
            } else {
                Logger.auth.warning(
                    "biometric silent reactivation incomplete (tokens=\(tokensReady), key=\(keyReady))"
                )
                toastManager.show(
                    "La reconnaissance biométrique n'a pas pu être activée",
                    type: .error
                )
            }
        }

        if allowBiometricPrompt, shouldPromptBiometricEnrollment() {
            showBiometricEnrollment = true
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
        guard authState == .authenticated else { return }
        await clientKeyManager.clearAll()
        authState = .needsPinEntry
    }

    // MARK: - Session Expiry

    /// Called when APIClient detects an unrecoverable 401. AuthService.logout() was already
    /// called by APIClient — this method only resets local UI state.
    func handleSessionExpired() async {
        await clientKeyManager.clearSession()
        currentUser = nil
        authState = .unauthenticated
        biometricError = "Ta session a expiré, reconnecte-toi"
    }

    // MARK: - Maintenance Actions

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
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
        if biometricEnabled, let clientKeyHex = await resolveBiometricKey() {
            if await validateBiometricKey(clientKeyHex) {
                return
            }
            Logger.auth.warning("handleEnterForeground: stale biometric key, requiring PIN")
            await clientKeyManager.clearAll()
            biometricEnabled = false
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
        await keychainManager.saveLastUsedEmail(email)
        hasReturningUser = true
        returningUserFlagLoaded = true
        await resolvePostAuth(user: user)
    }

    func logout() async {
        if biometricEnabled {
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
                biometricEnabled = false
            }
        } else {
            await authService.logout()
        }

        await clientKeyManager.clearSession()
        currentUser = nil
        authState = .unauthenticated
        showBiometricEnrollment = false
        showRecoveryKeyRepairConsent = false
        showPostAuthRecoveryKeySheet = false
        needsRecoveryKeyRepairConsent = false
        postAuthRecoveryKey = nil
        showPostAuthError = false
        biometricError = nil

        // Clear sensitive widget data
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()

        // Reset navigation
        budgetPath = NavigationPath()
        templatePath = NavigationPath()
        selectedTab = .currentMonth
    }

    /// Complete password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen.
    func completePasswordResetFlow() async {
        await authService.logout()
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometricEnabled = false
        resetAfterPasswordResetCleanup()
        toastManager.show("Mot de passe réinitialisé, reconnecte-toi", type: .success)
    }

    /// Cancel password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen without success feedback.
    func cancelPasswordResetFlow() async {
        await authService.logout()
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometricEnabled = false
        resetAfterPasswordResetCleanup()
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
        await logout()
    }

    private func resetAfterPasswordResetCleanup() {
        currentUser = nil
        authState = .unauthenticated
        biometricError = nil
        showBiometricEnrollment = false
        showRecoveryKeyRepairConsent = false
        showPostAuthRecoveryKeySheet = false
        needsRecoveryKeyRepairConsent = false
        postAuthRecoveryKey = nil

        // Clear sensitive widget data
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()

        // Reset navigation
        budgetPath = NavigationPath()
        templatePath = NavigationPath()
        selectedTab = .currentMonth
    }
}

// MARK: - Biometric Actions

extension AppState {
    func shouldPromptBiometricEnrollment() -> Bool {
        biometricCapability() && !biometricEnabled && authState == .authenticated && !biometricEnrollmentDismissed
    }

    func dismissBiometricEnrollment() {
        UserDefaults.standard.set(true, forKey: UserDefaultsKey.biometricEnrollmentDismissed)
        showBiometricEnrollment = false
    }

    /// Attempt Face ID unlock from PinEntryView. Returns true if client key was restored.
    func attemptBiometricUnlock() async -> Bool {
        guard biometricEnabled else { return false }
        guard let clientKeyHex = await resolveBiometricKey() else { return false }

        guard await validateBiometricKey(clientKeyHex) else {
            Logger.auth.warning("attemptBiometricUnlock: stale biometric key detected, clearing")
            await clientKeyManager.clearAll()
            biometricEnabled = false
            return false
        }
        return true
    }

    func canRetryBiometric() async -> Bool {
        guard biometricCapability() else { return false }
        return await authService.hasBiometricTokens()
    }

    func retryBiometricLogin() async {
        biometricError = nil
        await checkAuthState()
    }

    private func ensureBiometricPreferenceLoaded() async {
        guard !biometricPreferenceLoaded else { return }

        let storedPreference = await biometricPreferenceStore.load()
        isHydratingBiometricPreference = true
        biometricEnabled = storedPreference
        isHydratingBiometricPreference = false
        biometricPreferenceLoaded = true
    }

    private func ensureReturningUserFlagLoaded() async {
        guard !returningUserFlagLoaded else { return }
        hasReturningUser = await keychainManager.getLastUsedEmail() != nil
        returningUserFlagLoaded = true
    }

    @discardableResult
    func enableBiometric() async -> Bool {
        authDebug("AUTH_BIO_ENABLE_START", "enableBiometric")
        guard biometricCapability() else { return false }

        do {
            try await biometricAuthenticate()
        } catch {
            Logger.auth.info("enableBiometric: user denied biometric prompt")
            return false
        }

        do {
            try await authService.saveBiometricTokens()
            authDebug("AUTH_BIO_ENABLE_SAVE_TOKENS", "success")
        } catch {
            Logger.auth.error("enableBiometric: failed to save biometric tokens - \(error)")
            authDebug("AUTH_BIO_ENABLE_SAVE_TOKENS", "failed")
            return false
        }

        let clientKeyStored = await clientKeyManager.enableBiometric()
        authDebug("AUTH_BIO_ENABLE_STORE_KEY", clientKeyStored ? "success" : "failed")
        guard clientKeyStored else { return false }

        biometricEnabled = true
        biometricCredentialsAvailable = true
        UserDefaults.standard.removeObject(forKey: UserDefaultsKey.biometricEnrollmentDismissed)
        authDebug("AUTH_BIO_ENABLE_RESULT", "success")
        return true
    }

    func disableBiometric() async {
        await authService.clearBiometricTokens()
        await clientKeyManager.disableBiometric()
        biometricEnabled = false
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
            needsRecoveryKeyRepairConsent = needsRecoveryConsent
            authState = .needsPinEntry
        case .authenticated:
            // Vault fully configured — verify existing PIN
            authState = .needsPinEntry
        case .unauthenticatedSessionExpired, .vaultCheckFailed:
            showPostAuthError = true
        }
    }

    func completePinSetup() async {
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

        await transitionToAuthenticated()
    }

    func completePinEntry() async {
        if needsRecoveryKeyRepairConsent {
            showBiometricEnrollment = false
            showRecoveryKeyRepairConsent = true
            return
        }

        await transitionToAuthenticated()
    }

    func startRecovery() {
        authState = .needsPinRecovery
    }

    func completeRecovery() async {
        await transitionToAuthenticated()
    }

    func cancelRecovery() {
        authState = .needsPinEntry
    }

    func acceptRecoveryKeyRepairConsent() async {
        showRecoveryKeyRepairConsent = false

        do {
            let recoveryKey = try await encryptionAPI.setupRecoveryKey()
            postAuthRecoveryKey = recoveryKey
            showPostAuthRecoveryKeySheet = true
        } catch let error as APIError {
            if case .conflict = error {
                Logger.auth.info("acceptRecoveryKeyRepairConsent: recovery key already exists, continue")
                needsRecoveryKeyRepairConsent = false
                await transitionToAuthenticated()
                return
            }

            Logger.auth.error("acceptRecoveryKeyRepairConsent: setup-recovery failed - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            needsRecoveryKeyRepairConsent = false
            await transitionToAuthenticated()
        } catch {
            Logger.auth.error("acceptRecoveryKeyRepairConsent: unexpected setup-recovery error - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            needsRecoveryKeyRepairConsent = false
            await transitionToAuthenticated()
        }
    }

    func declineRecoveryKeyRepairConsent() async {
        showRecoveryKeyRepairConsent = false
        needsRecoveryKeyRepairConsent = false
        await transitionToAuthenticated()
    }

    func completePostAuthRecoveryKeyPresentation() async {
        showPostAuthRecoveryKeySheet = false
        postAuthRecoveryKey = nil
        needsRecoveryKeyRepairConsent = false
        await transitionToAuthenticated()
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
