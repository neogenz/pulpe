import OSLog

@Observable @MainActor
final class BiometricManager {
    // MARK: - Public State

    var isEnabled: Bool = false {
        didSet {
            guard !isHydrating else { return }
            saveTask?.cancel()
            saveTask = Task {
                await preferenceStore.save(isEnabled)
            }
        }
    }

    var showEnrollmentPrompt = false
    var credentialsAvailable = true

    // MARK: - Private State

    private var preferenceLoaded = false
    private var isHydrating = false
    private var saveTask: Task<Void, Never>?

    private var enrollmentDismissed: Bool {
        UserDefaults.standard.bool(forKey: "pulpe-biometric-enrollment-dismissed")
    }

    // MARK: - Dependencies

    private let preferenceStore: BiometricPreferenceStore
    private let authService: AuthService
    private let clientKeyManager: ClientKeyManager
    private let capability: @Sendable () -> Bool
    private let _authenticate: @Sendable () async throws -> Void
    private let _syncCredentials: @Sendable () async -> Bool
    private let _resolveKey: @Sendable () async -> String?
    private let _validateKey: @Sendable (String) async -> Bool

    // MARK: - Init

    init(
        preferenceStore: BiometricPreferenceStore,
        authService: AuthService,
        clientKeyManager: ClientKeyManager,
        capability: @Sendable @escaping () -> Bool,
        authenticate: @Sendable @escaping () async throws -> Void,
        syncCredentials: @Sendable @escaping () async -> Bool,
        resolveKey: @Sendable @escaping () async -> String?,
        validateKey: @Sendable @escaping (String) async -> Bool
    ) {
        self.preferenceStore = preferenceStore
        self.authService = authService
        self.clientKeyManager = clientKeyManager
        self.capability = capability
        _authenticate = authenticate
        _syncCredentials = syncCredentials
        _resolveKey = resolveKey
        _validateKey = validateKey
    }

    // MARK: - Preference Loading

    func loadPreference() async {
        guard !preferenceLoaded else { return }
        let storedPreference = await preferenceStore.load()
        isHydrating = true
        isEnabled = storedPreference
        isHydrating = false
        preferenceLoaded = true
    }

    /// Force-set `isEnabled` without triggering the didSet persistence.
    /// Used by reinstall detection to clear stale keychain state.
    func hydrate(_ value: Bool) {
        isHydrating = true
        isEnabled = value
        isHydrating = false
    }

    // MARK: - Enable / Disable

    @discardableResult
    func enable() async -> Bool {
        guard capability() else { return false }

        do {
            try await _authenticate()
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

        isEnabled = true
        credentialsAvailable = true
        UserDefaults.standard.removeObject(forKey: "pulpe-biometric-enrollment-dismissed")
        return true
    }

    func disable() async {
        await authService.clearBiometricTokens()
        await clientKeyManager.disableBiometric()
        isEnabled = false
    }

    // MARK: - Biometric Unlock

    func attemptUnlock() async -> Bool {
        guard isEnabled else { return false }
        guard let clientKeyHex = await _resolveKey() else { return false }

        guard await _validateKey(clientKeyHex) else {
            Logger.auth.warning("attemptBiometricUnlock: stale biometric key detected, clearing")
            await clientKeyManager.clearAll()
            isEnabled = false
            return false
        }
        return true
    }

    // MARK: - Key Resolution & Validation (used by AppState auth flows)

    func resolveKey() async -> String? {
        await _resolveKey()
    }

    func validateKey(_ clientKeyHex: String) async -> Bool {
        await _validateKey(clientKeyHex)
    }

    func syncCredentials() async -> Bool {
        await _syncCredentials()
    }

    // MARK: - Enrollment Prompt

    func shouldPromptEnrollment(authState: AppState.AuthStatus) -> Bool {
        capability() && !isEnabled && authState == .authenticated && !enrollmentDismissed
    }

    func dismissEnrollment() {
        UserDefaults.standard.set(true, forKey: "pulpe-biometric-enrollment-dismissed")
        showEnrollmentPrompt = false
    }

    // MARK: - Post-Auth Sync

    /// Syncs biometric credentials and client key after authentication.
    /// Returns `false` if biometric is enabled but sync failed.
    func syncAfterAuth() async -> Bool {
        guard isEnabled else { return true }
        let tokensReady = await _syncCredentials()
        let keyReady = await clientKeyManager.enableBiometric()
        if tokensReady && keyReady {
            credentialsAvailable = true
            return true
        }
        Logger.auth.warning(
            "biometric silent reactivation incomplete (tokens=\(tokensReady), key=\(keyReady))"
        )
        return false
    }

    // MARK: - Session Expired

    func handleSessionExpired() async {
        await clientKeyManager.clearAll()
        await authService.clearBiometricTokens()
        credentialsAvailable = false
    }

    // MARK: - Stale Key

    func handleStaleKey() async {
        await clientKeyManager.clearAll()
        isEnabled = false
    }

    // MARK: - Default Closure Factories

    static func defaultSyncCredentials(
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

    static func defaultResolveKey(
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

    static func defaultValidateKey(
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
}
