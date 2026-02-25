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

    // MARK: - Utilities

    var nowProvider: @Sendable () -> Date

    // MARK: - Production Default

    static var `default`: AppStateDependencies {
        AppStateDependencies(
            authService: AuthService.shared,
            clientKeyManager: ClientKeyManager.shared,
            keychainManager: KeychainManager.shared,
            encryptionAPI: EncryptionAPI.shared,
            biometricService: BiometricService.shared,
            biometricPreferenceStore: BiometricPreferenceStore(),
            nowProvider: Date.init
        )
    }
}
