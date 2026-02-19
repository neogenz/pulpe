import OSLog
import SwiftUI
import WidgetKit

@Observable @MainActor
final class AppState {
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

    // MARK: - Maintenance & Network State

    private(set) var isInMaintenance = false
    private(set) var isNetworkUnavailable = false

    // MARK: - Navigation

    var selectedTab: Tab = .currentMonth
    var budgetPath = NavigationPath()
    var templatePath = NavigationPath()

    // MARK: - Onboarding & Tutorial

    var hasCompletedOnboarding: Bool = false {
        didSet {
            Task {
                await keychainManager.setOnboardingCompleted(hasCompletedOnboarding)
            }
        }
    }

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
    var showPostAuthRecoveryKeySheet = false
    private(set) var pinEntryAllowsBiometricUnlock = false
    private(set) var needsRecoveryKeyRepairConsent = false
    private(set) var postAuthRecoveryKey: String?

    // MARK: - Background Grace Period

    private var backgroundDate: Date?
    private var biometricSaveTask: Task<Void, Never>?
    private var biometricPreferenceLoaded = false
    private var isHydratingBiometricPreference = false

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
            syncBiometricCredentials ??
            {
                do {
                    try await authService.saveBiometricTokens()
                    return true
                } catch {
                    Logger.auth.warning("transitionToAuthenticated: saveBiometricTokens failed, trying fallback - \(error)")
                    let saved = await authService.saveBiometricTokensFromKeychain()
                    if !saved {
                        Logger.auth.error("transitionToAuthenticated: biometric token persistence failed")
                    }
                    return saved
                }
            }

        // Load persisted values asynchronously
        Task { @MainActor in
            hasCompletedOnboarding = await keychainManager.isOnboardingCompleted()
            await ensureBiometricPreferenceLoaded()
        }
    }

    // MARK: - Actions

    func checkAuthState() async {
        authState = .loading
        biometricError = nil
        pinEntryAllowsBiometricUnlock = false

        await ensureBiometricPreferenceLoaded()

        // Cold start: clear session clientKey so a stale key in keychain
        // can't bypass FaceID/PIN. Biometric keychain is preserved.
        await clientKeyManager.clearSession()

        #if DEBUG
        // In DEBUG mode, try regular token-based session first (no biometric prompt)
        // This keeps developers logged in across app restarts from Xcode
        if let user = try? await authService.validateSession() {
            currentUser = user
            await resolvePostAuth(user: user)
            return
        }
        #endif

        guard biometricEnabled else {
            // Clear any stale tokens from previous install
            await authService.clearBiometricTokens()
            authState = .unauthenticated
            return
        }

        do {
            if let result = try await authService.validateBiometricSession() {
                currentUser = result.user
                if let clientKeyHex = result.clientKeyHex {
                    await clientKeyManager.store(clientKeyHex, enableBiometric: false)
                }
                await resolvePostAuth(user: result.user)
            } else {
                // No tokens found
                authState = .unauthenticated
            }
        } catch is KeychainError {
            // Face ID cancelled or failed — keep tokens for retry
            authState = .unauthenticated
        } catch let error as URLError {
            // Network error — keep tokens and biometric enabled for retry
            Logger.auth.warning("checkAuthState: network error during biometric login - \(error)")
            biometricError = "Connexion impossible, réessaie"
            authState = .unauthenticated
        } catch let error as AuthServiceError {
            // Auth-specific error (expired tokens, etc.)
            Logger.auth.error("checkAuthState: biometric session refresh failed - \(error)")
            await authService.clearBiometricTokens()
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        } catch {
            // Unknown error - preserve tokens for transient issues
            Logger.auth.error("checkAuthState: unknown error during biometric login - \(error)")
            biometricError = "Une erreur s'est produite, réessaie"
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
            pinEntryAllowsBiometricUnlock = false
            needsRecoveryKeyRepairConsent = false
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            pinEntryAllowsBiometricUnlock = false
            needsRecoveryKeyRepairConsent = needsRecoveryConsent
            authState = .needsPinEntry
        case .authenticated(let needsRecoveryConsent):
            pinEntryAllowsBiometricUnlock = false
            needsRecoveryKeyRepairConsent = needsRecoveryConsent
            if needsRecoveryConsent {
                transitionToAuthenticated(allowBiometricPrompt: false)
                showBiometricEnrollment = false
                showRecoveryKeyRepairConsent = true
            } else {
                transitionToAuthenticated()
            }
        case .unauthenticatedSessionExpired:
            pinEntryAllowsBiometricUnlock = false
            needsRecoveryKeyRepairConsent = false
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        }
    }

    func login(email: String, password: String) async throws {
        authState = .loading
        pinEntryAllowsBiometricUnlock = false

        do {
            let user = try await authService.login(email: email, password: password)
            // Don't set hasCompletedOnboarding here - login is separate from onboarding flow.
            // Only completeOnboarding() should set this flag.
            await resolvePostAuth(user: user)
        } catch {
            authState = .unauthenticated
            throw error
        }
    }

    func logout() async {
        if biometricEnabled {
            // Refresh biometric tokens with the latest session before clearing
            do {
                try await authService.saveBiometricTokens()
            } catch {
                Logger.auth.warning("logout: SDK session unavailable, falling back to keychain - \(error)")
                let saved = await authService.saveBiometricTokensFromKeychain()
                if !saved {
                    Logger.auth.error("logout: could not preserve biometric tokens for re-login")
                }
            }

            // Clear local SDK state WITHOUT calling /logout (would revoke the refresh token)
            await authService.logoutKeepingBiometricSession()
        } else {
            await authService.logout()
        }

        await clientKeyManager.clearSession()
        currentUser = nil
        authState = .unauthenticated
        showBiometricEnrollment = false
        showRecoveryKeyRepairConsent = false
        showPostAuthRecoveryKeySheet = false
        pinEntryAllowsBiometricUnlock = false
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

        await logout()
    }

    private func resetAfterPasswordResetCleanup() {
        currentUser = nil
        authState = .unauthenticated
        biometricError = nil
        showBiometricEnrollment = false
        showRecoveryKeyRepairConsent = false
        showPostAuthRecoveryKeySheet = false
        pinEntryAllowsBiometricUnlock = false
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

    private func transitionToAuthenticated(allowBiometricPrompt: Bool = true) {
        authState = .authenticated

        if biometricEnabled {
            Task {
                let tokensReady = await syncBiometricCredentials()
                let keyReady = await clientKeyManager.enableBiometric()
                if !tokensReady || !keyReady {
                    Logger.auth.warning(
                        "transitionToAuthenticated: biometric silent reactivation incomplete (tokens=\(tokensReady), key=\(keyReady))"
                    )
                }
            }
        }

        if allowBiometricPrompt, shouldPromptBiometricEnrollment() {
            showBiometricEnrollment = true
        }
    }

    func completeOnboarding(user: UserInfo, onboardingData: BudgetTemplateCreateFromOnboarding) {
        currentUser = user
        hasCompletedOnboarding = true
        pendingOnboardingData = onboardingData
        // After onboarding, user needs to set up PIN
        pinEntryAllowsBiometricUnlock = false
        authState = .needsPinSetup
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

        transitionToAuthenticated()
    }

    func completePinEntry() {
        if needsRecoveryKeyRepairConsent {
            showBiometricEnrollment = false
            showRecoveryKeyRepairConsent = true
            return
        }

        transitionToAuthenticated()
    }

    func startRecovery() {
        pinEntryAllowsBiometricUnlock = false
        authState = .needsPinRecovery
    }

    func completeRecovery() {
        transitionToAuthenticated()
    }

    func cancelRecovery() {
        pinEntryAllowsBiometricUnlock = false
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
                transitionToAuthenticated()
                return
            }

            Logger.auth.error("acceptRecoveryKeyRepairConsent: setup-recovery failed - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            needsRecoveryKeyRepairConsent = false
            transitionToAuthenticated()
        } catch {
            Logger.auth.error("acceptRecoveryKeyRepairConsent: unexpected setup-recovery error - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            needsRecoveryKeyRepairConsent = false
            transitionToAuthenticated()
        }
    }

    func declineRecoveryKeyRepairConsent() {
        showRecoveryKeyRepairConsent = false
        needsRecoveryKeyRepairConsent = false
        transitionToAuthenticated()
    }

    func completePostAuthRecoveryKeyPresentation() {
        showPostAuthRecoveryKeySheet = false
        postAuthRecoveryKey = nil
        needsRecoveryKeyRepairConsent = false
        transitionToAuthenticated()
    }

    // MARK: - Background Lock

    func handleEnterBackground() {
        backgroundDate = nowProvider()
    }

    func handleEnterForeground() async {
        guard let bgDate = backgroundDate else { return }
        backgroundDate = nil

        let elapsed = Duration.seconds(nowProvider().timeIntervalSince(bgDate))
        guard elapsed >= AppConfiguration.backgroundGracePeriod else { return }
        guard authState == .authenticated else { return }

        // Grace period exceeded — clear in-memory clientKey and require re-entry
        await clientKeyManager.clearCache()
        pinEntryAllowsBiometricUnlock = biometricEnabled
        authState = .needsPinEntry
    }

    func resetTips() {
        ProductTips.resetAllTips()
    }

    // MARK: - Biometric Actions

    func shouldPromptBiometricEnrollment() -> Bool {
        biometricCapability() && !biometricEnabled && authState == .authenticated
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

    @discardableResult
    func enableBiometric() async -> Bool {
        guard biometricCapability() else { return false }

        do {
            try await biometricAuthenticate()
        } catch {
            Logger.auth.info("enableBiometric: user denied biometric prompt")
            return false
        }

        do {
            try await authService.saveBiometricTokens()
        } catch {
            Logger.auth.error("enableBiometric: failed to save biometric tokens - \(error)")
            return false
        }

        let clientKeyStored = await clientKeyManager.enableBiometric()
        guard clientKeyStored else { return false }

        biometricEnabled = true
        return true
    }

    func disableBiometric() async {
        await authService.clearBiometricTokens()
        await clientKeyManager.disableBiometric()
        biometricEnabled = false
    }

    // MARK: - Stale Client Key

    func handleStaleClientKey() async {
        guard authState == .authenticated else { return }
        await clientKeyManager.clearAll()
        pinEntryAllowsBiometricUnlock = false
        authState = .needsPinEntry
    }

    // MARK: - Maintenance Actions

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
    }

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
