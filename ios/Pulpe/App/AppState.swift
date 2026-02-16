import OSLog
import SwiftUI
import WidgetKit

private enum UserDefaultsKey {
    static let onboardingCompleted = "pulpe-onboarding-completed"
    static let biometricEnabled = "pulpe-biometric-enabled"
    static let amountsHidden = "pulpe-amounts-hidden"
}

/// Thread-safe UserDefaults actor to avoid blocking main thread
actor UserDefaultsStore {
    static let shared = UserDefaultsStore()
    
    private let defaults = UserDefaults.standard
    
    func getBool(forKey key: String) -> Bool {
        defaults.bool(forKey: key)
    }
    
    func setBool(_ value: Bool, forKey key: String) {
        defaults.set(value, forKey: key)
    }
}

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
                await UserDefaultsStore.shared.setBool(hasCompletedOnboarding, forKey: UserDefaultsKey.onboardingCompleted)
            }
        }
    }

    var pendingOnboardingData: BudgetTemplateCreateFromOnboarding?

    // MARK: - Biometric

    var biometricEnabled: Bool = false {
        didSet {
            Task {
                await UserDefaultsStore.shared.setBool(biometricEnabled, forKey: UserDefaultsKey.biometricEnabled)
            }
        }
    }

    // MARK: - Amount Visibility

    var amountsHidden: Bool = false {
        didSet {
            Task {
                await UserDefaultsStore.shared.setBool(amountsHidden, forKey: UserDefaultsKey.amountsHidden)
            }
        }
    }

    func toggleAmountsVisibility() {
        amountsHidden.toggle()
    }

    var showBiometricEnrollment = false
    var biometricError: String?

    // MARK: - Background Grace Period

    private var backgroundDate: Date?
    private static let gracePeriod: TimeInterval = 300 // 5 minutes

    // MARK: - Services

    private let authService: AuthService
    private let biometricService: BiometricService
    private let clientKeyManager: ClientKeyManager
    private let encryptionAPI: EncryptionAPI

    // MARK: - Toast

    let toastManager = ToastManager()

    init(
        authService: AuthService = .shared,
        biometricService: BiometricService = .shared,
        clientKeyManager: ClientKeyManager = .shared,
        encryptionAPI: EncryptionAPI = .shared
    ) {
        self.authService = authService
        self.biometricService = biometricService
        self.clientKeyManager = clientKeyManager
        self.encryptionAPI = encryptionAPI
        
        // Load UserDefaults values asynchronously
        Task { @MainActor in
            hasCompletedOnboarding = await UserDefaultsStore.shared.getBool(forKey: UserDefaultsKey.onboardingCompleted)
            biometricEnabled = await UserDefaultsStore.shared.getBool(forKey: UserDefaultsKey.biometricEnabled)
            amountsHidden = await UserDefaultsStore.shared.getBool(forKey: UserDefaultsKey.amountsHidden)
        }
    }

    // MARK: - Actions

    func checkAuthState() async {
        authState = .loading
        biometricError = nil

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
            biometricEnabled = false
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        } catch {
            // Unknown error - preserve tokens for transient issues
            Logger.auth.error("checkAuthState: unknown error during biometric login - \(error)")
            biometricError = "Une erreur s'est produite, réessaie"
            authState = .unauthenticated
        }
    }

    /// After Supabase session is valid, route to PIN setup/entry or straight to authenticated
    private func resolvePostAuth(user: UserInfo) async {
        let isVaultConfigured: Bool
        do {
            let status = try await encryptionAPI.getVaultStatus()
            isVaultConfigured = status.vaultCodeConfigured
        } catch {
            Logger.auth.error("resolvePostAuth: vault status check failed - \(error)")
            // Fallback to PIN entry (safe for returning users; new users go through completeOnboarding)
            isVaultConfigured = true
        }

        guard isVaultConfigured else {
            authState = .needsPinSetup
            return
        }

        // Check if we already have a clientKey in memory/keychain
        if await clientKeyManager.resolveClientKey() != nil {
            authState = .authenticated
            return
        }

        authState = .needsPinEntry
    }

    func login(email: String, password: String) async throws {
        let user = try await authService.login(email: email, password: password)
        currentUser = user
        // Don't set hasCompletedOnboarding here - login is separate from onboarding flow
        // Only completeOnboarding() should set this flag
        await resolvePostAuth(user: user)
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

        // Clear sensitive widget data
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()

        // Reset navigation
        budgetPath = NavigationPath()
        templatePath = NavigationPath()
        selectedTab = .currentMonth
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

    func completeOnboarding(user: UserInfo, onboardingData: BudgetTemplateCreateFromOnboarding) {
        currentUser = user
        hasCompletedOnboarding = true
        pendingOnboardingData = onboardingData
        // After onboarding, user needs to set up PIN
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
                return
            }
        }

        authState = .authenticated

        // Prompt biometric enrollment after PIN setup
        if shouldPromptBiometricEnrollment() {
            showBiometricEnrollment = true
        }
    }

    func completePinEntry() {
        authState = .authenticated

        if shouldPromptBiometricEnrollment() {
            showBiometricEnrollment = true
        }
    }

    func startRecovery() {
        authState = .needsPinRecovery
    }

    func completeRecovery() {
        authState = .authenticated

        // Prompt biometric enrollment after recovery
        if shouldPromptBiometricEnrollment() {
            showBiometricEnrollment = true
        }
    }

    func cancelRecovery() {
        authState = .needsPinEntry
    }

    // MARK: - Background Lock

    func handleEnterBackground() {
        backgroundDate = Date()
    }

    func handleEnterForeground() async {
        guard let bgDate = backgroundDate else { return }
        backgroundDate = nil

        let elapsed = Date().timeIntervalSince(bgDate)
        guard elapsed > Self.gracePeriod else { return }
        guard authState == .authenticated else { return }

        // Grace period exceeded — clear in-memory clientKey and require re-entry
        await clientKeyManager.clearCache()
        authState = .needsPinEntry
    }

    func resetTips() {
        ProductTips.resetAllTips()
    }

    // MARK: - Biometric Actions

    func shouldPromptBiometricEnrollment() -> Bool {
        biometricService.canUseBiometrics() && !biometricEnabled && authState == .authenticated
    }

    func canRetryBiometric() async -> Bool {
        guard biometricService.canUseBiometrics() else { return false }
        return await authService.hasBiometricTokens()
    }

    func retryBiometricLogin() async {
        biometricError = nil
        await checkAuthState()
    }

    @discardableResult
    func enableBiometric() async -> Bool {
        guard biometricService.canUseBiometrics() else { return false }

        do {
            try await biometricService.authenticate()
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
