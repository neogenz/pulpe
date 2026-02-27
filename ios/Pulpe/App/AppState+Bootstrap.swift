import OSLog

// MARK: - Bootstrap & Cold Start

extension AppState {
    /// Performs one-time async setup: reinstall detection, returning-user flag, biometric preference.
    /// Idempotent — safe to call multiple times; only the first call executes.
    func bootstrap() async {
        guard !isBootstrapped else { return }
        isBootstrapped = true
        await clearKeychainIfReinstalled()
        if !returningUserFlagLoaded {
            hasReturningUser = await keychainManager.getLastUsedEmail() != nil
            returningUserFlagLoaded = true
        }
        await biometric.loadPreference()
    }

    /// Public startup entrypoint.
    func start() async {
        await checkAuthState()
    }

    /// Public retry entrypoint for startup failures (network/maintenance transitions).
    func retryStartup() async {
        await checkAuthState()
    }

    func checkAuthState() async {
        authDebug("AUTH_COLD_START_BEGIN", "checkAuthState")

        // Ensure bootstrap ran (idempotent safety net)
        await bootstrap()

        // Reset transitional route flags for a fresh startup resolution.
        // Final route (maintenance/network/login/pin/main) is set from startup result.
        isInMaintenance = false
        isNetworkUnavailable = false
        authState = .loading
        lastLockReason = .coldStart
        biometricError = nil
        await biometric.loadPreference()
        authDebug("AUTH_COLD_START_PREF", "biometricEnabled=\(biometric.isEnabled)")

        // Cold start: clear session clientKey so a stale key in keychain
        // can't bypass FaceID/PIN. Biometric keychain is preserved.
        await clientKeyManager.clearSession()

        let startupContext = StartupCoordinator.StartupContext(
            biometricEnabled: biometric.isEnabled,
            didExplicitLogout: flagsStore.didExplicitLogout,
            manualBiometricRetryRequired: flagsStore.manualBiometricRetryRequired
        )
        let bio = startupContext.biometricEnabled
        let logout = startupContext.didExplicitLogout
        let retry = startupContext.manualBiometricRetryRequired
        authDebug("AUTH_STARTUP_CONTEXT", "bio=\(bio) logout=\(logout) retry=\(retry)")
        let startupResult = await startupCoordinator.start(context: startupContext)
        authDebug("AUTH_STARTUP_DONE", "result=\(startupResult)")
        await applyStartupResult(startupResult)
    }

    func applyColdStartResult(_ result: SessionLifecycleCoordinator.ColdStartResult) async {
        authDebug("AUTH_COLD_START_RESULT", "result=\(result)")
        switch result {
        case .biometricAuthenticated(let user, _):
            currentUser = user
            await resolvePostAuth(user: user)
        case .regularSession(let user):
            await resolvePostAuth(user: user)
        case .unauthenticated:
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        case .networkError(let message):
            biometricError = message
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        case .biometricSessionExpired:
            biometricError = "Ta session a expir\u{00E9}, connecte-toi avec ton mot de passe"
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        }
    }

    func clearKeychainIfReinstalled() async {
        guard !flagsStore.hasLaunchedBefore else { return }

        Logger.auth.info("First launch detected — clearing stale keychain data")
        await keychainManager.clearAllData()

        // Reset in-memory state
        biometric.hydrate(false)
        hasReturningUser = false
        returningUserFlagLoaded = true
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()

        flagsStore.setHasLaunchedBefore()
    }

    func ensureReturningUserFlagLoaded() async {
        guard !returningUserFlagLoaded else { return }
        hasReturningUser = await keychainManager.getLastUsedEmail() != nil
        returningUserFlagLoaded = true
    }

    private func applyStartupResult(_ result: StartupCoordinator.StartupResult) async {
        authDebug("AUTH_STARTUP_RESULT", "result=\(result)")
        switch result {
        case .authenticated(let user, let destination):
            isNetworkUnavailable = false
            isInMaintenance = false
            currentUser = user
            await applyPostAuthDestination(destination, user: user)
        case .unauthenticated:
            isNetworkUnavailable = false
            isInMaintenance = false
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        case .maintenance:
            isNetworkUnavailable = false
            isInMaintenance = true
            authState = .loading
        case .networkError(let message):
            isNetworkUnavailable = true
            isInMaintenance = false
            biometricError = message
            authState = .loading
        case .biometricSessionExpired:
            isNetworkUnavailable = false
            isInMaintenance = false
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        case .cancelled:
            // No-op: a superseding startup run is in progress.
            break
        case .timeout:
            isNetworkUnavailable = true
            isInMaintenance = false
            biometricError = "Le chargement a pris trop de temps, réessaie"
            authState = .loading
        }
    }
}
