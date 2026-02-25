import OSLog

@Observable @MainActor
final class BiometricManager {
    enum EnrollmentSource: String, Sendable {
        case automatic
        case manual
    }

    private enum UserDefaultsKey {
        static let automaticEnrollmentAttempted = "pulpe-biometric-enrollment-dismissed"
    }

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

    var credentialsAvailable = true

    // MARK: - Private State

    private var preferenceLoaded = false
    private var isHydrating = false
    private var isEnrollmentInFlight = false
    private var saveTask: Task<Void, Never>?

    private var automaticEnrollmentAttempted: Bool {
        UserDefaults.standard.bool(forKey: UserDefaultsKey.automaticEnrollmentAttempted)
    }

    private func setAutomaticEnrollmentAttempted(_ attempted: Bool) {
        if attempted {
            UserDefaults.standard.set(true, forKey: UserDefaultsKey.automaticEnrollmentAttempted)
        } else {
            UserDefaults.standard.removeObject(forKey: UserDefaultsKey.automaticEnrollmentAttempted)
        }
    }

    private func enrollmentDebug(
        _ code: String,
        source: EnrollmentSource,
        reason: String,
        outcome: String
    ) {
        #if DEBUG
        let message = "[AUTH_BIO_ENROLL_\(code)] " +
            "source=\(source.rawValue) " +
            "reason=\(reason) " +
            "outcome=\(outcome) " +
            "inFlight=\(isEnrollmentInFlight)"
        Logger.auth.debug("\(message, privacy: .public)")
        #endif
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
    func enable(
        source: EnrollmentSource = .manual,
        reason: String = "unspecified"
    ) async -> Bool {
        if source == .automatic, automaticEnrollmentAttempted {
            enrollmentDebug("SKIP", source: source, reason: reason, outcome: "already_attempted")
            return false
        }
        guard capability() else {
            enrollmentDebug("SKIP", source: source, reason: reason, outcome: "capability_unavailable")
            return false
        }
        guard !isEnabled else {
            enrollmentDebug("SKIP", source: source, reason: reason, outcome: "already_enabled")
            return true
        }
        guard !isEnrollmentInFlight else {
            enrollmentDebug("SKIP", source: source, reason: reason, outcome: "enrollment_in_flight")
            return false
        }

        if source == .automatic {
            // One-shot policy: automatic enrollment is attempted only once, even on denial/failure.
            setAutomaticEnrollmentAttempted(true)
        }
        isEnrollmentInFlight = true
        enrollmentDebug("START", source: source, reason: reason, outcome: "attempting")
        defer {
            isEnrollmentInFlight = false
        }

        do {
            try await _authenticate()
        } catch {
            Logger.auth.info("enableBiometric: user denied biometric prompt")
            enrollmentDebug("END", source: source, reason: reason, outcome: "authenticate_failed")
            return false
        }

        do {
            try await authService.saveBiometricTokens()
        } catch {
            Logger.auth.error("enableBiometric: failed to save biometric tokens - \(error)")
            enrollmentDebug("END", source: source, reason: reason, outcome: "token_save_failed")
            return false
        }

        let clientKeyStored = await clientKeyManager.enableBiometric()
        guard clientKeyStored else {
            enrollmentDebug("END", source: source, reason: reason, outcome: "client_key_save_failed")
            return false
        }

        isEnabled = true
        credentialsAvailable = true
        // Persist one-shot automatic policy after successful enrollment too.
        setAutomaticEnrollmentAttempted(true)
        enrollmentDebug("END", source: source, reason: reason, outcome: "success")
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

    func shouldAttemptAutomaticEnrollment(authState: AppState.AuthStatus) -> Bool {
        capability() && !isEnabled && authState == .authenticated && !automaticEnrollmentAttempted
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
