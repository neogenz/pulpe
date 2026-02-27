import OSLog

/// Coordinates session lifecycle: cold start auth routing, background/foreground
/// lock with grace period, and foreground session restoration via biometric unlock.
///
/// Returns typed result enums for AppState to map into auth state transitions.
/// Does NOT set `authState` directly.
@MainActor
final class SessionLifecycleCoordinator {
    // MARK: - Result Types
    enum ColdStartResult: Equatable {
        case biometricAuthenticated(user: UserInfo, clientKeyHex: String?)
        case regularSession(user: UserInfo)
        case unauthenticated
        case networkError(String)
        case biometricSessionExpired
    }

    enum ForegroundResult: Equatable {
        case noLockNeeded
        case biometricUnlockSuccess
        case lockRequired
        case staleKeyLockRequired
    }

    // MARK: - State

    private(set) var isRestoringSession = false
    private var backgroundDate: Date?

    // MARK: - Dependencies

    private let biometric: BiometricManager
    private let clientKeyManager: ClientKeyManager
    private let validateRegularSession: @Sendable () async throws -> UserInfo?
    private let validateBiometricSession: @Sendable () async throws -> BiometricSessionResult?
    private let nowProvider: () -> Date

    init(
        biometric: BiometricManager,
        clientKeyManager: ClientKeyManager,
        validateRegularSession: @escaping @Sendable () async throws -> UserInfo?,
        validateBiometricSession: @escaping @Sendable () async throws -> BiometricSessionResult?,
        nowProvider: @escaping () -> Date
    ) {
        self.biometric = biometric
        self.clientKeyManager = clientKeyManager
        self.validateRegularSession = validateRegularSession
        self.validateBiometricSession = validateBiometricSession
        self.nowProvider = nowProvider
    }

    // MARK: - Cold Start

    /// Validates the biometric session and returns a result for AppState to apply.
    func attemptBiometricSessionValidation() async -> ColdStartResult {
        authDebug("AUTH_BIO_VALIDATE_START", "attemptBiometricSessionValidation")
        do {
            if let result = try await validateBiometricSession() {
                if let clientKeyHex = result.clientKeyHex {
                    if await biometric.validateKey(clientKeyHex) {
                        await clientKeyManager.store(clientKeyHex, enableBiometric: false)
                    } else {
                        Logger.auth.warning("attemptBiometricSessionValidation: stale biometric key, clearing")
                        await biometric.handleStaleKey()
                    }
                }
                authDebug("AUTH_BIO_VALIDATE_RESULT", "success")
                return .biometricAuthenticated(user: result.user, clientKeyHex: result.clientKeyHex)
            } else {
                authDebug("AUTH_BIO_VALIDATE_RESULT", "no_tokens")
                return await fallbackToRegularSession(reason: "no_tokens")
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
            return await fallbackToRegularSession(reason: "keychain_error")
        } catch let error as URLError {
            Logger.auth.warning("checkAuthState: network error during biometric login - \(error)")
            authDebug("AUTH_BIO_VALIDATE_RESULT", "network")
            return .networkError("Connexion impossible, r\u{00E9}essaie")
        } catch let error as AuthServiceError {
            Logger.auth.error("checkAuthState: biometric session refresh failed - \(error)")
            await biometric.handleSessionExpired()
            authDebug("AUTH_BIO_VALIDATE_RESULT", "session_expired")
            return .biometricSessionExpired
        } catch {
            Logger.auth.error("checkAuthState: unknown error during biometric login - \(error)")
            await biometric.handleSessionExpired()
            authDebug("AUTH_BIO_VALIDATE_RESULT", "session_expired")
            return .biometricSessionExpired
        }
    }

    /// Falls back to regular session validation after biometric failure.
    private func fallbackToRegularSession(reason: String) async -> ColdStartResult {
        authDebug("AUTH_COLD_START_REGULAR_FALLBACK", "reason=\(reason)")
        do {
            if let user = try await validateRegularSession() {
                authDebug("AUTH_COLD_START_REGULAR_VALID", "reason=\(reason)")
                return .regularSession(user: user)
            } else {
                authDebug("AUTH_COLD_START_REGULAR_MISSING", "reason=\(reason)")
                return .unauthenticated
            }
        } catch {
            Logger.auth.warning("checkAuthState: regular session fallback failed - \(error)")
            authDebug("AUTH_COLD_START_REGULAR_ERROR", "reason=\(reason)")
            return .unauthenticated
        }
    }

    /// Validates a regular (non-biometric) session.
    func attemptRegularSessionValidation() async -> ColdStartResult {
        do {
            if let user = try await validateRegularSession() {
                authDebug("AUTH_COLD_START_REGULAR_VALID", "source=checkAuthState")
                return .regularSession(user: user)
            }
        } catch {
            Logger.auth.warning("checkAuthState: regular session validation failed - \(error)")
            authDebug("AUTH_COLD_START_REGULAR_ERROR", "source=checkAuthState")
        }
        authDebug("AUTH_COLD_START_REGULAR_MISSING", "source=checkAuthState")
        return .unauthenticated
    }

    // MARK: - Background Lock

    var isBackgroundLockRequired: Bool {
        guard let bgDate = backgroundDate else { return false }
        let elapsed = Duration.seconds(nowProvider().timeIntervalSince(bgDate))
        return elapsed >= AppConfiguration.backgroundGracePeriod
    }

    func handleEnterBackground() {
        backgroundDate = nowProvider()
        authDebug("AUTH_BG_DATE", "recorded=\(String(describing: backgroundDate))")
    }

    func prepareForForeground(authState: AppState.AuthStatus) {
        let applies = backgroundLockApplies(authState: authState)
        authDebug("AUTH_FG_PREPARE", "lockApplies=\(applies) authState=\(authState)")
        guard applies else { return }
        isRestoringSession = true
    }

    func clearRestoringSession() {
        isRestoringSession = false
    }

    // MARK: - Foreground

    /// Handles foreground entry after grace period: clears background date,
    /// clears client key cache, and attempts biometric unlock.
    /// Returns a result for AppState to map into state transitions.
    func handleEnterForeground(authState: AppState.AuthStatus) async -> ForegroundResult {
        guard backgroundLockApplies(authState: authState) else {
            return .noLockNeeded
        }
        let bgDesc = String(describing: backgroundDate)
        authDebug("AUTH_FG_LOCK", "bgDate=\(bgDesc) bio=\(biometric.isEnabled)")
        backgroundDate = nil

        await clientKeyManager.clearCache()
        authDebug("AUTH_FG_LOCK", "cache cleared, checking biometric key")

        if biometric.isEnabled, let clientKeyHex = await biometric.resolveKey() {
            authDebug("AUTH_FG_LOCK", "key resolved, validating")
            if await biometric.validateKey(clientKeyHex) {
                authDebug("AUTH_FG_LOCK", "key valid, biometric unlock success")
                return .biometricUnlockSuccess
            }
            authDebug("AUTH_FG_LOCK", "key stale, requiring PIN")
            Logger.auth.warning("handleEnterForeground: stale biometric key, requiring PIN")
            await biometric.handleStaleKey()
            return .staleKeyLockRequired
        }

        authDebug("AUTH_FG_LOCK", "no biometric key, lock required")
        return .lockRequired
    }

    // MARK: - Private

    private func backgroundLockApplies(authState: AppState.AuthStatus) -> Bool {
        guard let bgDate = backgroundDate else {
            authDebug("AUTH_BG_CHECK", "no backgroundDate, skip lock")
            return false
        }
        let elapsed = Duration.seconds(nowProvider().timeIntervalSince(bgDate))
        let threshold = AppConfiguration.backgroundGracePeriod
        let applies = elapsed >= threshold && authState == .authenticated
        authDebug(
            "AUTH_BG_CHECK",
            "elapsed=\(elapsed) threshold=\(threshold) authState=\(authState) applies=\(applies)"
        )
        return applies
    }

    private func authDebug(_ code: String, _ message: String) {
        #if DEBUG
        Logger.auth.debug("[\(code, privacy: .public)] \(message, privacy: .public)")
        #endif
    }
}
