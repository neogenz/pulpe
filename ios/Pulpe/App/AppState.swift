import OSLog
import SwiftUI

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

    var authState: AuthStatus = .loading
    var currentUser: UserInfo?
    var showPostAuthError = false

    // MARK: - Maintenance & Network State

    var isInMaintenance = false
    var isNetworkUnavailable = false

    // MARK: - Navigation

    var selectedTab: Tab = .currentMonth
    var budgetPath = NavigationPath()
    var templatePath = NavigationPath()

    // MARK: - Returning User

    var hasReturningUser: Bool = false

    var pendingOnboardingData: BudgetTemplateCreateFromOnboarding? {
        get { onboardingBootstrapper.pendingOnboardingData }
        set { onboardingBootstrapper.setPendingData(newValue) }
    }

    // MARK: - Biometric (delegated to BiometricManager)

    let biometric: BiometricManager
    @ObservationIgnored let enrollmentPolicy: BiometricAutomaticEnrollmentPolicy

    let recoveryFlowCoordinator: RecoveryFlowCoordinator
    @ObservationIgnored let onboardingBootstrapper: OnboardingBootstrapper

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

    @ObservationIgnored let sessionLifecycleCoordinator: SessionLifecycleCoordinator

    var isRestoringSession: Bool { sessionLifecycleCoordinator.isRestoringSession }

    var backgroundRefreshTask: Task<Void, Never>?
    var isLoggingOut = false
    var isBootstrapped = false
    var returningUserFlagLoaded = false

    // MARK: - Services

    let authService: AuthService
    let clientKeyManager: ClientKeyManager
    let keychainManager: any KeychainEmailStoring
    let encryptionAPI: EncryptionAPI
    let postAuthResolver: any PostAuthResolving
    let validateRegularSession: @Sendable () async throws -> UserInfo?
    @ObservationIgnored let flagsStore: any AppAuthFlagsStoring
    @ObservationIgnored let widgetSyncing: any WidgetSyncing
    @ObservationIgnored let maintenanceChecking: @Sendable () async throws -> Bool

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
        self.flagsStore = deps.flagsStore
        self.widgetSyncing = deps.widgetSyncing
        self.maintenanceChecking = deps.maintenanceChecking

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

        let coordinators = Self.makeCoordinators(
            deps: deps, biometric: self.biometric,
            validateRegularSession: self.validateRegularSession,
            toastManager: toastManager
        )
        self.recoveryFlowCoordinator = coordinators.recovery
        self.onboardingBootstrapper = coordinators.onboarding
        self.sessionLifecycleCoordinator = coordinators.session
    }

    private struct Coordinators {
        let recovery: RecoveryFlowCoordinator
        let onboarding: OnboardingBootstrapper
        let session: SessionLifecycleCoordinator
    }

    private static func makeCoordinators(
        deps: AppStateDependencies,
        biometric: BiometricManager,
        validateRegularSession: @escaping @Sendable () async throws -> UserInfo?,
        toastManager: ToastManager
    ) -> Coordinators {
        let recovery: RecoveryFlowCoordinator
        if let setupRecoveryKey = deps.setupRecoveryKey {
            recovery = RecoveryFlowCoordinator(
                setupRecoveryKey: setupRecoveryKey,
                toastManager: toastManager
            )
        } else {
            recovery = RecoveryFlowCoordinator(
                encryptionAPI: deps.encryptionAPI,
                toastManager: toastManager
            )
        }
        let onboarding = OnboardingBootstrapper(
            createTemplate: deps.createTemplate,
            createBudget: deps.createBudget,
            toastManager: toastManager
        )
        let session = SessionLifecycleCoordinator(
            biometric: biometric,
            clientKeyManager: deps.clientKeyManager,
            validateRegularSession: validateRegularSession,
            validateBiometricSession: deps.validateBiometricSession
                ?? defaultValidateBiometricSession(deps.authService),
            nowProvider: deps.nowProvider
        )
        return Coordinators(recovery: recovery, onboarding: onboarding, session: session)
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

    // MARK: - Debug

    func authDebug(_ code: String, _ message: String) {
        #if DEBUG
        Logger.auth.debug("[\(code, privacy: .public)] \(message, privacy: .public)")
        #endif
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
