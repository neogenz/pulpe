import Foundation

/// Groups all external dependencies for AppState construction.
/// Provides `.default` for production use.
struct AppStateDependencies {
    // MARK: - Services

    var authService: AuthService
    var clientKeyManager: ClientKeyManager
    var keychainManager: any KeychainEmailStoring
    var encryptionAPI: EncryptionAPI
    var postAuthResolver: (any PostAuthResolving)?

    // MARK: - Biometric Configuration

    var biometricService: BiometricService
    var biometricPreferenceStore: BiometricPreferenceStore
    var biometricCapability: (@Sendable () -> Bool)?
    var biometricAuthenticate: (@Sendable () async throws -> Void)?
    var syncBiometricCredentials: (@Sendable () async -> Bool)?
    var resolveBiometricKey: (@Sendable () async -> String?)?
    var validateBiometricKey: (@Sendable (String) async -> Bool)?

    // MARK: - Recovery

    var setupRecoveryKey: (@Sendable () async throws -> String)?

    // MARK: - Session Validators

    var validateRegularSession: (@Sendable () async throws -> UserInfo?)?
    var validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)?
    var deleteAccountRequest: (@Sendable () async throws -> DeleteAccountResponse)?

    // MARK: - Auth Flags & Widget

    var flagsStore: any AppAuthFlagsStoring
    var widgetSyncing: any WidgetSyncing

    // MARK: - Maintenance

    var maintenanceChecking: @Sendable () async throws -> Bool

    // MARK: - Onboarding Closures

    var createTemplate: @MainActor (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate
    var createBudget: @MainActor (BudgetCreate) async throws -> Budget

    // MARK: - Utilities

    var nowProvider: @Sendable () -> Date

    // swiftlint:disable function_default_parameter_at_end
    init(
        authService: AuthService,
        clientKeyManager: ClientKeyManager,
        keychainManager: any KeychainEmailStoring,
        encryptionAPI: EncryptionAPI,
        postAuthResolver: (any PostAuthResolving)? = nil,
        biometricService: BiometricService,
        biometricPreferenceStore: BiometricPreferenceStore,
        biometricCapability: (@Sendable () -> Bool)? = nil,
        biometricAuthenticate: (@Sendable () async throws -> Void)? = nil,
        syncBiometricCredentials: (@Sendable () async -> Bool)? = nil,
        resolveBiometricKey: (@Sendable () async -> String?)? = nil,
        validateBiometricKey: (@Sendable (String) async -> Bool)? = nil,
        setupRecoveryKey: (@Sendable () async throws -> String)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        deleteAccountRequest: (@Sendable () async throws -> DeleteAccountResponse)? = nil,
        flagsStore: any AppAuthFlagsStoring = AppAuthFlagsStore(),
        widgetSyncing: any WidgetSyncing = WidgetSyncAdapter(),
        maintenanceChecking: @escaping @Sendable () async throws -> Bool = {
            try await MaintenanceService.shared.checkStatus()
        },
        createTemplate: @escaping @MainActor
            (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate = { data in
            try await TemplateService.shared.createTemplateFromOnboarding(data)
        },
        createBudget: @escaping @MainActor
            (BudgetCreate) async throws -> Budget = { data in
            try await BudgetService.shared.createBudget(data)
        },
        nowProvider: @escaping @Sendable () -> Date = { Date() }
    ) {
        self.authService = authService
        self.clientKeyManager = clientKeyManager
        self.keychainManager = keychainManager
        self.encryptionAPI = encryptionAPI
        self.postAuthResolver = postAuthResolver
        self.biometricService = biometricService
        self.biometricPreferenceStore = biometricPreferenceStore
        self.biometricCapability = biometricCapability
        self.biometricAuthenticate = biometricAuthenticate
        self.syncBiometricCredentials = syncBiometricCredentials
        self.resolveBiometricKey = resolveBiometricKey
        self.validateBiometricKey = validateBiometricKey
        self.setupRecoveryKey = setupRecoveryKey
        self.validateRegularSession = validateRegularSession
        self.validateBiometricSession = validateBiometricSession
        self.deleteAccountRequest = deleteAccountRequest
        self.flagsStore = flagsStore
        self.widgetSyncing = widgetSyncing
        self.maintenanceChecking = maintenanceChecking
        self.createTemplate = createTemplate
        self.createBudget = createBudget
        self.nowProvider = nowProvider
    }
    // swiftlint:enable function_default_parameter_at_end

    // MARK: - Production Default

    static var `default`: AppStateDependencies {
        AppStateDependencies(
            authService: AuthService.shared,
            clientKeyManager: ClientKeyManager.shared,
            keychainManager: KeychainManager.shared,
            encryptionAPI: EncryptionAPI.shared,
            biometricService: BiometricService.shared,
            biometricPreferenceStore: BiometricPreferenceStore()
        )
    }
}
