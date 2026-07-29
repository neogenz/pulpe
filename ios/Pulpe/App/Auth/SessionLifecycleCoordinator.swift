import OSLog

/// Coordinates the background/foreground lock with grace period and biometric
/// client-key restoration.
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
    private let nowProvider: () -> Date

    /// Upper bound on the foreground biometric unlock (PUL-279). Injectable so tests can
    /// shrink it; production uses `AppConfiguration.foregroundUnlockTimeout`.
    private let foregroundUnlockTimeout: Duration

    init(
        biometric: BiometricManager,
        clientKeyManager: ClientKeyManager,
        nowProvider: @escaping () -> Date,
        foregroundUnlockTimeout: Duration = AppConfiguration.foregroundUnlockTimeout
    ) {
        self.biometric = biometric
        self.clientKeyManager = clientKeyManager
        self.nowProvider = nowProvider
        self.foregroundUnlockTimeout = foregroundUnlockTimeout
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
