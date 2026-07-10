import OSLog
import Supabase

/// Coordinates session lifecycle: cold start auth routing, background/foreground
/// lock with grace period, and foreground session restoration via biometric unlock.
///
/// Returns typed result enums for AppState to map into auth state transitions.
/// Does NOT set `authState` directly.
///
/// `@Observable` so `isRestoringSession` flips drive SwiftUI: the privacy shield
/// (`AppRuntimeCoordinator.shouldShowPrivacyShield`) reads this flag transitively, and
/// without observation it would never re-render to clear the blur when restore completes.
@Observable @MainActor
final class SessionLifecycleCoordinator {
    // MARK: - Result Types
    enum ColdStartResult: Equatable {
        case biometricAuthenticated(user: UserInfo, clientKeyHex: String?)
        case regularSession(user: UserInfo)
        case unauthenticated
        case networkError(String)
        case biometricSessionExpired
        /// The user dismissed or failed the Face ID prompt — nothing to apply,
        /// credentials and the login-screen button must stay intact.
        case cancelled
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

    /// Upper bound on the foreground biometric unlock (PUL-279). Injectable so tests can
    /// shrink it; production uses `AppConfiguration.foregroundUnlockTimeout`.
    private let foregroundUnlockTimeout: Duration

    init(
        biometric: BiometricManager,
        clientKeyManager: ClientKeyManager,
        validateRegularSession: @escaping @Sendable () async throws -> UserInfo?,
        validateBiometricSession: @escaping @Sendable () async throws -> BiometricSessionResult?,
        nowProvider: @escaping () -> Date,
        foregroundUnlockTimeout: Duration = AppConfiguration.foregroundUnlockTimeout
    ) {
        self.biometric = biometric
        self.clientKeyManager = clientKeyManager
        self.validateRegularSession = validateRegularSession
        self.validateBiometricSession = validateBiometricSession
        self.nowProvider = nowProvider
        self.foregroundUnlockTimeout = foregroundUnlockTimeout
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
            return await handleBiometricKeychainError(error)
        } catch AuthServiceError.biometricSessionExpired {
            Logger.auth.error("checkAuthState: biometric session expired")
            await biometric.handleSessionExpired()
            authDebug("AUTH_BIO_VALIDATE_RESULT", "session_expired")
            return .biometricSessionExpired
        } catch AuthError.sessionMissing {
            Logger.auth.error("checkAuthState: biometric session missing")
            await biometric.handleSessionExpired()
            authDebug("AUTH_BIO_VALIDATE_RESULT", "session_missing")
            return .biometricSessionExpired
        } catch let error as URLError {
            Logger.auth.warning("checkAuthState: network error during biometric login - \(error)")
            authDebug("AUTH_BIO_VALIDATE_RESULT", "network")
            return .networkError(AuthErrorMessages.connectionUnavailable)
        } catch {
            Logger.auth.warning("checkAuthState: biometric validation deferred - \(error)")
            authDebug("AUTH_BIO_VALIDATE_RESULT", "retryable_error")
            return .networkError(AuthErrorMessages.connectionUnavailable)
        }
    }

    /// Maps a keychain failure from the biometric unlock to a cold-start result.
    /// Dismissing or failing the Face ID prompt is not a credential problem: falling
    /// back to the regular session (deleted on logout-keep-biometric) would confirm
    /// "no session" and wipe the biometric snapshot — the user would lose the Face ID
    /// button for a simple cancel. Only genuine keychain errors take the fallback.
    private func handleBiometricKeychainError(_ error: KeychainError) async -> ColdStartResult {
        switch error {
        case .userCanceled:
            authDebug("AUTH_BIO_VALIDATE_RESULT", "user_cancel")
            return .cancelled
        case .authFailed:
            authDebug("AUTH_BIO_VALIDATE_RESULT", "auth_failed")
            return .cancelled
        default:
            authDebug("AUTH_BIO_VALIDATE_RESULT", "keychain_error")
            return await fallbackToRegularSession(reason: "keychain_error")
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
        } catch AuthServiceError.biometricSessionExpired {
            await biometric.handleSessionExpired()
            authDebug("AUTH_COLD_START_REGULAR_EXPIRED", "reason=\(reason)")
            return .biometricSessionExpired
        } catch let error as URLError {
            // Transient connectivity failure — not a session loss. Surface the retry UI
            // rather than dropping the user to the login screen.
            Logger.auth.warning("checkAuthState: regular session fallback network error - \(error, privacy: .public)")
            authDebug("AUTH_COLD_START_REGULAR_NETWORK", "reason=\(reason)")
            return .networkError(AuthErrorMessages.connectionUnavailable)
        } catch {
            Logger.auth.warning("checkAuthState: regular session fallback deferred - \(error)")
            authDebug("AUTH_COLD_START_REGULAR_RETRY", "reason=\(reason)")
            return .networkError(AuthErrorMessages.connectionUnavailable)
        }
    }

    /// Validates a regular (non-biometric) session.
    func attemptRegularSessionValidation() async -> ColdStartResult {
        do {
            if let user = try await validateRegularSession() {
                authDebug("AUTH_COLD_START_REGULAR_VALID", "source=checkAuthState")
                return .regularSession(user: user)
            }
        } catch AuthServiceError.biometricSessionExpired {
            await biometric.handleSessionExpired()
            authDebug("AUTH_COLD_START_REGULAR_EXPIRED", "source=checkAuthState")
            return .biometricSessionExpired
        } catch let error as URLError {
            // Transient connectivity failure — not a session loss. Surface the retry UI.
            Logger.auth.warning("checkAuthState: regular session validation network error - \(error, privacy: .public)")
            authDebug("AUTH_COLD_START_REGULAR_NETWORK", "source=checkAuthState")
            return .networkError(AuthErrorMessages.connectionUnavailable)
        } catch {
            Logger.auth.warning("checkAuthState: regular session validation deferred - \(error)")
            authDebug("AUTH_COLD_START_REGULAR_RETRY", "source=checkAuthState")
            return .networkError(AuthErrorMessages.connectionUnavailable)
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
    ///
    /// The biometric unlock is bounded by `foregroundUnlockTimeout` (PUL-279): a hung
    /// Face ID prompt or stalled validation routes to PIN entry instead of leaving the
    /// privacy shield frozen. The financial content stays masked either way.
    func handleEnterForeground(authState: AppState.AuthStatus) async -> ForegroundResult {
        guard backgroundLockApplies(authState: authState) else {
            return .noLockNeeded
        }
        let bgDesc = String(describing: backgroundDate)
        authDebug("AUTH_FG_LOCK", "bgDate=\(bgDesc) bio=\(biometric.isEnabled)")
        backgroundDate = nil

        await clientKeyManager.clearCache()
        authDebug("AUTH_FG_LOCK", "cache cleared, checking biometric key")

        guard biometric.isEnabled else {
            authDebug("AUTH_FG_LOCK", "biometric disabled, lock required")
            return .lockRequired
        }

        switch await attemptBiometricUnlockWithinTimeout() {
        case .success:
            authDebug("AUTH_FG_LOCK", "key valid, biometric unlock success")
            return .biometricUnlockSuccess
        case .stale:
            authDebug("AUTH_FG_LOCK", "key stale, requiring PIN")
            Logger.auth.warning("handleEnterForeground: stale biometric key, requiring PIN")
            await biometric.handleStaleKey()
            return .staleKeyLockRequired
        case .noKey:
            authDebug("AUTH_FG_LOCK", "no biometric key, lock required")
            return .lockRequired
        case .timedOut:
            authDebug("AUTH_FG_LOCK", "unlock timed out, requiring PIN")
            Logger.auth.warning("handleEnterForeground: foreground unlock timed out, requiring PIN")
            return .lockRequired
        }
    }

    // MARK: - Bounded Biometric Unlock (PUL-279)

    private enum ForegroundUnlockOutcome: Sendable {
        case success
        case stale
        case noKey
        case timedOut
    }

    /// Resolves the biometric key then validates it. Pure with respect to coordinator state —
    /// side effects (`handleStaleKey`) are applied by the caller so a timed-out, abandoned
    /// run never mutates state late.
    private func attemptBiometricUnlock() async -> ForegroundUnlockOutcome {
        guard let clientKeyHex = await biometric.resolveKey() else {
            return .noKey
        }
        return await biometric.validateKey(clientKeyHex) ? .success : .stale
    }

    /// Races the biometric unlock against `foregroundUnlockTimeout` and returns whichever
    /// resolves first. Uses unstructured tasks (not a task group) on purpose: the system
    /// Face ID prompt may ignore cancellation, so a structured group would still block on the
    /// hung child. A late unlock result is ignored once the timeout has resolved.
    private func attemptBiometricUnlockWithinTimeout() async -> ForegroundUnlockOutcome {
        await withCheckedContinuation { (continuation: CheckedContinuation<ForegroundUnlockOutcome, Never>) in
            let unlockGuard = ForegroundUnlockGuard(continuation)
            Task(name: "ForegroundUnlock.operation") { @MainActor in
                unlockGuard.resolve(await self.attemptBiometricUnlock())
            }
            Task(name: "ForegroundUnlock.timeout") { @MainActor in
                try? await Task.sleep(for: self.foregroundUnlockTimeout)
                unlockGuard.resolve(.timedOut)
            }
        }
    }

    /// Resolves a `CheckedContinuation` exactly once across the racing unlock and timeout
    /// tasks. Main-actor isolated so the two resumers never race; the second resume is a no-op.
    @MainActor
    private final class ForegroundUnlockGuard {
        private var continuation: CheckedContinuation<ForegroundUnlockOutcome, Never>?

        init(_ continuation: CheckedContinuation<ForegroundUnlockOutcome, Never>) {
            self.continuation = continuation
        }

        func resolve(_ outcome: ForegroundUnlockOutcome) {
            continuation?.resume(returning: outcome)
            continuation = nil
        }
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
