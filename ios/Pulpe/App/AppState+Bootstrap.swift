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

    func checkAuthState() async {
        authDebug("AUTH_COLD_START_BEGIN", "checkAuthState")

        // Ensure bootstrap ran (idempotent safety net)
        await bootstrap()

        authState = .loading
        biometricError = nil
        await biometric.loadPreference()
        authDebug("AUTH_COLD_START_PREF", "biometricEnabled=\(biometric.isEnabled)")

        // Cold start: clear session clientKey so a stale key in keychain
        // can't bypass FaceID/PIN. Biometric keychain is preserved.
        await clientKeyManager.clearSession()

        if flagsStore.manualBiometricRetryRequired {
            authDebug("AUTH_COLD_START_BRANCH", "manual_retry_required")
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
            return
        }

        // 1. Biometric: Face ID -> PIN/dashboard (skip if user explicitly logged out)
        if biometric.isEnabled && !flagsStore.didExplicitLogout {
            authDebug("AUTH_COLD_START_BRANCH", "biometric")
            await applyColdStartResult(
                sessionLifecycleCoordinator.attemptBiometricSessionValidation()
            )
            return
        }

        authDebug("AUTH_COLD_START_BRANCH", "regular")

        // 2. Session valid -> PIN entry (keeps user logged in without biometric)
        let result = await sessionLifecycleCoordinator.attemptRegularSessionValidation()
        await applyColdStartResult(result)
    }

    func applyColdStartResult(_ result: SessionLifecycleCoordinator.ColdStartResult) async {
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
}
