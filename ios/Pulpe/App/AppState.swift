import OSLog
import Supabase
import SwiftUI

@Observable @MainActor
// swiftlint:disable:next type_body_length
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

    /// A user whose onboarding was interrupted and needs to resume via a fresh
    /// `OnboardingFlow`. The case determines whether persisted storage is wiped
    /// (social: fresh slate) or restored (email: resume at persisted step).
    var pendingOnboardingUser: PendingOnboardingUser?

    /// Identity token for the current onboarding session. Regenerated on abandon
    /// to force `OnboardingFlow` to re-instantiate from scratch — SwiftUI reuses
    /// the view otherwise, keeping stale `@State` (e.g. `currentStep`) in memory.
    var onboardingSessionID = UUID()

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
    @ObservationIgnored let startupCoordinator: StartupCoordinator

    var isRestoringSession: Bool { sessionLifecycleCoordinator.isRestoringSession }

    var lastLockReason: AppFlowState.LockReason = .coldStart

    var backgroundRefreshTask: Task<Void, Never>?
    var isLoggingOut = false
    var isBootstrapped = false
    var returningUserFlagLoaded = false

    /// Serialized event queue for async events to prevent race conditions.
    @ObservationIgnored private(set) lazy var eventQueue: AppFlowEventQueue = {
        AppFlowEventQueue { [weak self] event in
            await self?.handleAsyncEvent(event)
        }
    }()

    // MARK: - Services

    let authService: AuthService
    let clientKeyManager: ClientKeyManager
    let keychainManager: any KeychainEmailStoring
    let encryptionAPI: EncryptionAPI
    let postAuthResolver: any PostAuthResolving
    let validateRegularSession: @Sendable () async throws -> UserInfo?
    let deleteAccountRequest: @Sendable () async throws -> DeleteAccountResponse
    let performSignOut: @Sendable (SignOutScope) async -> Void
    @ObservationIgnored let flagsStore: any AppAuthFlagsStoring
    @ObservationIgnored let widgetSyncing: any WidgetSyncing
    @ObservationIgnored let maintenanceChecking: @Sendable () async throws -> Bool

    // MARK: - Session Data Reset

    var sessionDataResetter: (any SessionDataResetting)?

    // MARK: - Toast

    let toastManager = ToastManager()

    init(dependencies: AppStateDependencies = .default) {
        let deps = dependencies
        let biometricService = deps.biometricService
        let biometricCapability = deps.biometricCapability ?? { [biometricService] in
            biometricService.canUseBiometrics()
        }
        let biometricAuthenticate = deps.biometricAuthenticate ?? { [biometricService] in
            try await biometricService.authenticate()
        }
        self.authService = deps.authService
        self.clientKeyManager = deps.clientKeyManager
        self.keychainManager = deps.keychainManager
        self.encryptionAPI = deps.encryptionAPI
        self.postAuthResolver = Self.makePostAuthResolver(deps)
        self.validateRegularSession =
            deps.validateRegularSession ?? Self.defaultValidateRegularSession(deps.authService)
        self.deleteAccountRequest = Self.makeDeleteAccountRequest(deps)
        self.performSignOut = Self.makePerformSignOut(deps)
        self.flagsStore = deps.flagsStore
        self.widgetSyncing = deps.widgetSyncing
        self.maintenanceChecking = deps.maintenanceChecking

        self.biometric = BiometricManager(
            preferenceStore: deps.biometricPreferenceStore,
            authService: deps.authService,
            clientKeyManager: deps.clientKeyManager,
            capability: biometricCapability,
            authenticate: biometricAuthenticate,
            syncCredentials: deps.syncBiometricCredentials
                ?? BiometricManager.defaultSyncCredentials(deps.authService),
            resolveKey: deps.resolveBiometricKey
                ?? BiometricManager.defaultResolveKey(deps.clientKeyManager),
            validateKey: deps.validateBiometricKey
                ?? BiometricManager.defaultValidateKey(deps.encryptionAPI)
        )
        self.enrollmentPolicy = BiometricAutomaticEnrollmentPolicy(
            optOutStore: deps.biometricOptOutStore ?? UserDefaultsBiometricOptOutStore()
        )

        let coordinators = Self.makeCoordinators(
            deps: deps, biometric: self.biometric,
            validateRegularSession: self.validateRegularSession,
            postAuthResolver: self.postAuthResolver,
            toastManager: toastManager
        )
        self.recoveryFlowCoordinator = coordinators.recovery
        self.onboardingBootstrapper = coordinators.onboarding
        self.sessionLifecycleCoordinator = coordinators.session
        self.startupCoordinator = coordinators.startup
    }

    private struct Coordinators {
        let recovery: RecoveryFlowCoordinator
        let onboarding: OnboardingBootstrapper
        let session: SessionLifecycleCoordinator
        let startup: StartupCoordinator
    }

    private static func makeCoordinators(
        deps: AppStateDependencies,
        biometric: BiometricManager,
        validateRegularSession: @escaping @Sendable () async throws -> UserInfo?,
        postAuthResolver: any PostAuthResolving,
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
        let startup = StartupCoordinator(
            checkMaintenance: deps.maintenanceChecking,
            validateBiometricSession: deps.validateBiometricSession
                ?? defaultValidateBiometricSession(deps.authService),
            validateRegularSession: validateRegularSession,
            resolvePostAuth: { await postAuthResolver.resolve() },
            validateBiometricKey: { [biometric] clientKeyHex in
                await biometric.validateKey(clientKeyHex)
            },
            storeSessionClientKey: { [clientKeyManager = deps.clientKeyManager] clientKeyHex in
                await clientKeyManager.store(clientKeyHex, enableBiometric: false)
            },
            clearStaleBiometricState: { [biometric] in
                await biometric.handleStaleKey()
            },
            clearExpiredBiometricState: { [biometric] in
                await biometric.handleSessionExpired()
            }
        )
        return Coordinators(
            recovery: recovery,
            onboarding: onboarding,
            session: session,
            startup: startup
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
        biometricOptOutStore: (any BiometricOptOutStoring)? = nil,
        setupRecoveryKey: (@Sendable () async throws -> String)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        deleteAccountRequest: (@Sendable () async throws -> DeleteAccountResponse)? = nil,
        performSignOut: (@Sendable (SignOutScope) async -> Void)? = nil,
        maintenanceChecking: @escaping @Sendable () async throws -> Bool = {
            try await MaintenanceService.shared.checkStatus()
        },
        nowProvider: @escaping @Sendable () -> Date = { Date() }
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
            biometricOptOutStore: biometricOptOutStore,
            setupRecoveryKey: setupRecoveryKey,
            validateRegularSession: validateRegularSession,
            validateBiometricSession: validateBiometricSession,
            deleteAccountRequest: deleteAccountRequest,
            performSignOut: performSignOut,
            maintenanceChecking: maintenanceChecking,
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

    private static func makePostAuthResolver(
        _ deps: AppStateDependencies
    ) -> any PostAuthResolving {
        deps.postAuthResolver
            ?? PostAuthResolver(
                vaultStatusProvider: deps.encryptionAPI,
                sessionRefresher: deps.authService,
                clientKeyResolver: deps.clientKeyManager
            )
    }

    private static func makeDeleteAccountRequest(
        _ deps: AppStateDependencies
    ) -> @Sendable () async throws -> DeleteAccountResponse {
        deps.deleteAccountRequest
            ?? { [authService = deps.authService] in
                try await authService.deleteAccount()
            }
    }

    private static func makePerformSignOut(
        _ deps: AppStateDependencies
    ) -> @Sendable (SignOutScope) async -> Void {
        deps.performSignOut
            ?? { [authService = deps.authService] scope in
                await authService.logout(scope: scope)
            }
    }

    // MARK: - Biometric Proxy Methods

    @discardableResult
    func enableBiometric() async -> Bool {
        enrollmentPolicy.clearUserExplicitlyDisabled()
        return await biometric.enable(source: .manual, reason: "account_settings")
    }

    func disableBiometric() async {
        enrollmentPolicy.markUserExplicitlyDisabled()
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

// MARK: - Pending Onboarding User

/// A user mid-onboarding whose session needs to resume after a cold start
/// or provider-aware redirect. The case determines recovery behavior:
/// `.social` starts fresh (clearStorage); `.email` restores the persisted draft.
enum PendingOnboardingUser: Equatable, Sendable {
    case email(UserInfo)
    case social(UserInfo)

    /// Analytics label for the `onboarding_resumed` method property.
    enum ResumeMethod: String {
        case email
        case social
    }

    var user: UserInfo {
        switch self {
        case .email(let user), .social(let user):
            return user
        }
    }

    var resumeMethod: ResumeMethod {
        switch self {
        case .email: return .email
        case .social: return .social
        }
    }
}
