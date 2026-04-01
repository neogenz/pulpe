import OSLog

/// Coordinates app startup with single-flight guarantee.
/// Ensures only one auth resolution runs at a time, with proper cancellation of obsolete runs.
actor StartupCoordinator {
    // MARK: - State

    enum State: Equatable, Sendable {
        case idle
        case running(id: UUID)
        case completed(StartupResult)
    }

    enum StartupResult: Equatable, Sendable {
        case authenticated(user: UserInfo, destination: PostAuthDestination)
        case unauthenticated
        case maintenance
        case networkError(String)
        case biometricSessionExpired
        case cancelled
        case timeout
    }

    struct StartupContext: Equatable, Sendable {
        let biometricEnabled: Bool
        let didExplicitLogout: Bool
        let manualBiometricRetryRequired: Bool
    }

    /// Default startup timeout duration (30 seconds).
    static let defaultTimeout: Duration = .seconds(30)

    private(set) var state: State = .idle
    private var currentTask: Task<StartupResult, Never>?
    private var currentRunId: UUID?
    private let timeout: Duration

    // MARK: - Dependencies

    private let checkMaintenance: @Sendable () async throws -> Bool
    private let validateBiometricSession: @Sendable () async throws -> BiometricSessionResult?
    private let validateRegularSession: @Sendable () async throws -> UserInfo?
    private let validateBiometricKey: @Sendable (String) async -> Bool
    private let storeSessionClientKey: @Sendable (String) async -> Void
    private let clearStaleBiometricState: @Sendable () async -> Void
    private let clearExpiredBiometricState: @Sendable () async -> Void
    private let resolvePostAuth: @Sendable () async -> PostAuthDestination

    init(
        checkMaintenance: @escaping @Sendable () async throws -> Bool,
        validateBiometricSession: @escaping @Sendable () async throws -> BiometricSessionResult?,
        validateRegularSession: @escaping @Sendable () async throws -> UserInfo?,
        resolvePostAuth: @escaping @Sendable () async -> PostAuthDestination,
        validateBiometricKey: @escaping @Sendable (String) async -> Bool = { _ in true },
        storeSessionClientKey: @escaping @Sendable (String) async -> Void = { _ in },
        clearStaleBiometricState: @escaping @Sendable () async -> Void = {},
        clearExpiredBiometricState: @escaping @Sendable () async -> Void = {},
        timeout: Duration = StartupCoordinator.defaultTimeout
    ) {
        self.checkMaintenance = checkMaintenance
        self.validateBiometricSession = validateBiometricSession
        self.validateRegularSession = validateRegularSession
        self.validateBiometricKey = validateBiometricKey
        self.storeSessionClientKey = storeSessionClientKey
        self.clearStaleBiometricState = clearStaleBiometricState
        self.clearExpiredBiometricState = clearExpiredBiometricState
        self.resolvePostAuth = resolvePostAuth
        self.timeout = timeout
    }

    // MARK: - Public API

    /// Starts the startup sequence. If already running, cancels the previous run.
    /// Returns the result of the startup sequence.
    /// Applies a timeout to prevent indefinite blocking on slow/hanging operations.
    func start(context: StartupContext) async -> StartupResult {
        // Cancel any existing run
        cancelCurrentRun()

        let runId = UUID()
        currentRunId = runId
        state = .running(id: runId)

        let startupTask = Task<StartupResult, Never> {
            await executeStartupSequence(runId: runId, context: context)
        }
        currentTask = startupTask

        // When biometric auth will run, FaceID blocks on user interaction which
        // can take an arbitrary amount of time (phone on desk, etc.).
        // Skip the startup timeout — individual network operations within the
        // biometric flow have their own URLSession timeouts.
        let biometricWillRun = context.biometricEnabled
            && !context.didExplicitLogout
            && !context.manualBiometricRetryRequired

        let result: StartupResult

        if biometricWillRun {
            Logger.auth.debug("[STARTUP] Biometric path — no startup timeout")
            result = await startupTask.value
        } else {
            // Race startup against timeout for non-biometric paths
            result = await withTaskGroup(of: StartupResult.self) { group in
                group.addTask {
                    await startupTask.value
                }
                group.addTask { [timeout] in
                    do {
                        try await Task.sleep(for: timeout)
                        return .timeout
                    } catch {
                        // Cancelled - startup finished first
                        return .cancelled
                    }
                }

                // Return whichever finishes first
                guard let firstResult = await group.next() else {
                    return StartupResult.cancelled
                }
                group.cancelAll()

                // If timeout won, invalidate the run and cancel the startup task
                if firstResult == .timeout {
                    self.currentRunId = nil
                    startupTask.cancel()
                    Logger.auth.warning("[STARTUP] Startup timed out after \(self.timeout)")
                }

                return firstResult
            }
        }

        // Only update state if this run wasn't superseded
        if case .running(let currentId) = state, currentId == runId {
            state = .completed(result)
        }

        return result
    }

    /// Retries startup after a failure. Same as start() but with clearer intent.
    func retry(context: StartupContext) async -> StartupResult {
        await start(context: context)
    }

    /// Cancels any running startup and resets to idle.
    func cancel() {
        cancelCurrentRun()
        state = .idle
    }

    /// Resets the coordinator to idle state for a new session.
    func reset() {
        cancelCurrentRun()
        state = .idle
    }

    // MARK: - Private

    private func cancelCurrentRun() {
        currentTask?.cancel()
        currentTask = nil
        currentRunId = nil
    }

    private func isCurrentRun(_ id: UUID) -> Bool {
        currentRunId == id
    }

    private func executeStartupSequence(runId: UUID, context: StartupContext) async -> StartupResult {
        Logger.auth.debug("[STARTUP] Beginning startup sequence (id: \(runId.uuidString.prefix(8)))")

        if let maintenanceResult = await performMaintenanceCheck() {
            guard isCurrentRun(runId) && !Task.isCancelled else { return .cancelled }
            return maintenanceResult
        }

        guard isCurrentRun(runId) && !Task.isCancelled else { return .cancelled }

        if context.manualBiometricRetryRequired {
            Logger.auth.debug("[STARTUP] Manual biometric retry required - going to unauthenticated")
            return .unauthenticated
        }

        if let biometricResult = await performBiometricValidationIfNeeded(runId: runId, context: context) {
            return biometricResult
        }

        guard isCurrentRun(runId) && !Task.isCancelled else { return .cancelled }
        return await performRegularValidation(runId: runId)
    }

    private func performMaintenanceCheck() async -> StartupResult? {
        do {
            let isInMaintenance = try await checkMaintenance()
            guard !Task.isCancelled else { return .cancelled }
            if isInMaintenance {
                Logger.auth.info("[STARTUP] App is in maintenance mode")
                return .maintenance
            }
        } catch is CancellationError {
            Logger.auth.debug("[STARTUP] Maintenance check cancelled")
            return .cancelled
        } catch let error as URLError {
            if error.code == .cancelled {
                Logger.auth.debug("[STARTUP] Maintenance check URL request cancelled")
                return .cancelled
            } else {
                Logger.auth.warning("[STARTUP] Maintenance network error: \(error)")
                return .networkError("Connexion impossible, réessaie")
            }
        } catch {
            Logger.auth.warning("[STARTUP] Maintenance check failed: \(error)")
            // Fail-closed on non-network maintenance check failures.
            return .maintenance
        }
        return nil
    }

    private func performBiometricValidationIfNeeded(runId: UUID, context: StartupContext) async -> StartupResult? {
        guard context.biometricEnabled, !context.didExplicitLogout else { return nil }
        Logger.auth.debug("[STARTUP] Attempting biometric session validation")

        do {
            guard let biometricResult = try await validateBiometricSession() else {
                return nil
            }
            guard isCurrentRun(runId) else { return .cancelled }
            if let clientKeyHex = biometricResult.clientKeyHex {
                await handleBiometricClientKey(runId: runId, hex: clientKeyHex)
            }
            return await makeAuthenticatedResult(runId: runId, user: biometricResult.user, source: "Biometric")
        } catch {
            return await handleBiometricValidationError(error, runId: runId)
        }
    }

    private func handleBiometricValidationError(_ error: Error, runId: UUID) async -> StartupResult {
        if error is CancellationError {
            return .cancelled
        }
        if let urlError = error as? URLError {
            return handleBiometricURLError(urlError)
        }
        if let keychainError = error as? KeychainError {
            return await handleBiometricKeychainError(keychainError, runId: runId)
        }
        Logger.auth.warning("[STARTUP] Biometric validation failed: \(error)")
        guard isCurrentRun(runId) else { return .cancelled }
        await clearExpiredBiometricState()
        return .biometricSessionExpired
    }

    private func handleBiometricURLError(_ error: URLError) -> StartupResult {
        if error.code == .cancelled {
            Logger.auth.debug("[STARTUP] Biometric validation URL request cancelled")
            return .cancelled
        } else {
            Logger.auth.warning("[STARTUP] Biometric validation network error: \(error)")
            return .networkError("Connexion impossible, réessaie")
        }
    }

    private func handleBiometricKeychainError(_ error: KeychainError, runId: UUID) async -> StartupResult {
        switch error {
        case .userCanceled:
            Logger.auth.info("[STARTUP] Biometric auth cancelled by user")
            return .unauthenticated
        case .authFailed:
            Logger.auth.info("[STARTUP] Biometric auth failed")
            return .unauthenticated
        default:
            Logger.auth.warning("[STARTUP] Biometric validation failed: \(error)")
            guard isCurrentRun(runId) else { return .cancelled }
            await clearExpiredBiometricState()
            return .biometricSessionExpired
        }
    }

    private func handleBiometricClientKey(runId: UUID, hex: String) async {
        if await validateBiometricKey(hex) {
            guard isCurrentRun(runId) else { return }
            await storeSessionClientKey(hex)
        } else {
            Logger.auth.warning("[STARTUP] Stale biometric key, clearing state")
            guard isCurrentRun(runId) else { return }
            await clearStaleBiometricState()
        }
    }

    private func performRegularValidation(runId: UUID) async -> StartupResult {
        Logger.auth.debug("[STARTUP] Attempting regular session validation")

        do {
            guard let user = try await validateRegularSession() else {
                Logger.auth.info("[STARTUP] No valid session found - unauthenticated")
                return .unauthenticated
            }
            return await makeAuthenticatedResult(runId: runId, user: user, source: "Regular")
        } catch is CancellationError {
            Logger.auth.debug("[STARTUP] Regular session validation cancelled")
            return .cancelled
        } catch {
            Logger.auth.warning("[STARTUP] Regular session validation failed: \(error)")
            // AnalyticsService is @MainActor — hop required from actor context
            await MainActor.run {
                AnalyticsService.shared.captureAuthError(.sessionRestoreFailed, error: error, method: "regular")
            }
            if error is KeychainError {
                return .biometricSessionExpired
            }
            return .unauthenticated
        }
    }

    private func makeAuthenticatedResult(runId: UUID, user: UserInfo, source: String) async -> StartupResult {
        guard isCurrentRun(runId) && !Task.isCancelled else { return .cancelled }
        let destination = await resolvePostAuth()
        guard isCurrentRun(runId) && !Task.isCancelled else { return .cancelled }
        Logger.auth.info("[STARTUP] \(source) session valid, destination: \(String(describing: destination))")
        return .authenticated(user: user, destination: destination)
    }
}

// MARK: - Startup Result Mapping

extension StartupCoordinator.StartupResult {
    /// Maps the startup result to the appropriate auth state.
    var authState: AppState.AuthStatus {
        switch self {
        case .authenticated(_, let destination):
            switch destination {
            case .needsPinSetup:
                return .needsPinSetup
            case .needsPinEntry:
                return .needsPinEntry
            case .authenticated:
                return .authenticated
            case .unauthenticatedSessionExpired, .vaultCheckFailed:
                return .unauthenticated
            }
        case .unauthenticated, .networkError, .cancelled:
            return .unauthenticated
        case .biometricSessionExpired:
            return .unauthenticated
        case .maintenance:
            return .loading // Maintenance is handled separately
        case .timeout:
            return .loading // Timeout triggers network error UI
        }
    }

    /// Whether the result indicates a successful authentication.
    var isAuthenticated: Bool {
        if case .authenticated = self { return true }
        return false
    }
}
