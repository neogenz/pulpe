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
        state = .running(id: runId)

        let startupTask = Task<StartupResult, Never> {
            await executeStartupSequence(runId: runId, context: context)
        }
        currentTask = startupTask

        // Race startup against timeout
        let result = await withTaskGroup(of: StartupResult.self) { group in
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
                return .cancelled
            }
            group.cancelAll()

            // If timeout won, cancel the startup task
            if firstResult == .timeout {
                startupTask.cancel()
                Logger.auth.warning("[STARTUP] Startup timed out after \(self.timeout)")
            }

            return firstResult
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
    }

    private func executeStartupSequence(runId: UUID, context: StartupContext) async -> StartupResult {
        Logger.auth.debug("[STARTUP] Beginning startup sequence (id: \(runId.uuidString.prefix(8)))")

        if let maintenanceResult = await performMaintenanceCheck() {
            return maintenanceResult
        }

        guard !Task.isCancelled else { return .cancelled }

        if context.manualBiometricRetryRequired {
            Logger.auth.debug("[STARTUP] Manual biometric retry required - going to unauthenticated")
            return .unauthenticated
        }

        if let biometricResult = await performBiometricValidationIfNeeded(context: context) {
            return biometricResult
        }

        guard !Task.isCancelled else { return .cancelled }
        return await performRegularValidation()
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
            Logger.auth.warning("[STARTUP] Maintenance network error: \(error)")
            return .networkError("Connexion impossible, réessaie")
        } catch {
            Logger.auth.warning("[STARTUP] Maintenance check failed: \(error)")
            // Fail-closed on non-network maintenance check failures.
            return .maintenance
        }
        return nil
    }

    private func performBiometricValidationIfNeeded(context: StartupContext) async -> StartupResult? {
        guard context.biometricEnabled, !context.didExplicitLogout else { return nil }
        Logger.auth.debug("[STARTUP] Attempting biometric session validation")

        do {
            guard let biometricResult = try await validateBiometricSession() else {
                return nil
            }

            if let clientKeyHex = biometricResult.clientKeyHex {
                if await validateBiometricKey(clientKeyHex) {
                    await storeSessionClientKey(clientKeyHex)
                } else {
                    Logger.auth.warning("[STARTUP] Stale biometric key detected, clearing biometric state")
                    await clearStaleBiometricState()
                }
            }
            return await makeAuthenticatedResult(user: biometricResult.user, source: "Biometric")
        } catch is CancellationError {
            Logger.auth.debug("[STARTUP] Biometric validation cancelled")
            return .cancelled
        } catch let error as URLError {
            Logger.auth.warning("[STARTUP] Network error during biometric validation: \(error)")
            return .networkError("Connexion impossible, réessaie")
        } catch let error as AuthServiceError {
            Logger.auth.warning("[STARTUP] Biometric session expired: \(error)")
            await clearExpiredBiometricState()
            return .biometricSessionExpired
        } catch {
            Logger.auth.warning("[STARTUP] Biometric validation failed: \(error)")
            await clearExpiredBiometricState()
            return .biometricSessionExpired
        }
    }

    private func performRegularValidation() async -> StartupResult {
        Logger.auth.debug("[STARTUP] Attempting regular session validation")

        do {
            guard let user = try await validateRegularSession() else {
                Logger.auth.info("[STARTUP] No valid session found - unauthenticated")
                return .unauthenticated
            }
            return await makeAuthenticatedResult(user: user, source: "Regular")
        } catch is CancellationError {
            Logger.auth.debug("[STARTUP] Regular session validation cancelled")
            return .cancelled
        } catch {
            Logger.auth.warning("[STARTUP] Regular session validation failed: \(error)")
            Logger.auth.info("[STARTUP] No valid session found - unauthenticated")
            return .unauthenticated
        }
    }

    private func makeAuthenticatedResult(user: UserInfo, source: String) async -> StartupResult {
        guard !Task.isCancelled else { return .cancelled }
        let destination = await resolvePostAuth()
        guard !Task.isCancelled else { return .cancelled }
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
