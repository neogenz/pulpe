// MARK: - Auth (Login, Post-Auth Routing, Onboarding, PIN)

extension AppState {
    func login(email: String, password: String) async throws {
        authDebug("AUTH_LOGIN", "begin email=\(email.prefix(3))***")
        // NOTE: Do NOT set authState = .loading here.
        // LoginView handles its own loading state. Setting authState = .loading
        // would cause SwiftUI to unmount LoginView (showing LoadingView), then
        // remount it on error — causing a jarring close/reopen animation.

        let user = try await authService.login(email: email, password: password)
        await completeLogin(user: user)
        authDebug("AUTH_LOGIN", "complete")
    }

    func loginWithApple(idToken: String, nonce: String) async throws {
        authDebug("AUTH_LOGIN_APPLE", "begin")
        let user = try await authService.signInWithApple(idToken: idToken, nonce: nonce)
        await completeLogin(user: user)
        authDebug("AUTH_LOGIN_APPLE", "complete")
    }

    func loginWithGoogle(idToken: String, accessToken: String) async throws {
        authDebug("AUTH_LOGIN_GOOGLE", "begin")
        let user = try await authService.signInWithGoogle(idToken: idToken, accessToken: accessToken)
        await completeLogin(user: user)
        authDebug("AUTH_LOGIN_GOOGLE", "complete")
    }

    private func clearPreLoginFlags() {
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
    }

    private func prepareSession(user: UserInfo) async {
        clearPreLoginFlags()
        if !user.email.isEmpty {
            await keychainManager.saveLastUsedEmail(user.email)
        }
    }

    private func completeLogin(user: UserInfo) async {
        await prepareSession(user: user)
        hasReturningUser = true
        returningUserFlagLoaded = true
        await resolvePostAuth(user: user)
    }

    func loginWithBiometric() async {
        authDebug("AUTH_LOGIN_BIO", "begin")
        clearPreLoginFlags()
        await applyColdStartResult(
            sessionLifecycleCoordinator.attemptBiometricSessionValidation()
        )
    }

    /// After Supabase session is valid, route deterministically to setup/entry/app.
    func resolvePostAuth(user: UserInfo) async {
        let destination = await postAuthResolver.resolve()
        authDebug("AUTH_RESOLVE_POST_AUTH", "destination=\(destination)")
        await applyPostAuthDestination(destination, user: user)
    }

    func applyPostAuthDestination(_ destination: PostAuthDestination, user: UserInfo? = nil) async {
        if let user {
            currentUser = user
            AnalyticsService.shared.identify(userId: user.id)
        }
        authState = .loading

        if shouldRedirectToOnboarding(for: destination) {
            recoveryFlowCoordinator.reset()
            redirectToOnboardingForSocialUser()
            return
        }

        switch destination {
        case .needsPinSetup:
            recoveryFlowCoordinator.reset()
            authDebug("AUTH_POST_AUTH_DEST", "needsPinSetup")
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "needsPinEntry needsRecoveryConsent=\(needsRecoveryConsent)")
            recoveryFlowCoordinator.setPendingConsent(needsRecoveryConsent)
            authState = .needsPinEntry
        case .authenticated(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "authenticated needsRecoveryConsent=\(needsRecoveryConsent)")
            recoveryFlowCoordinator.setPendingConsent(false)
            if needsRecoveryConsent {
                recoveryFlowCoordinator.setConsentPrompt()
            } else {
                recoveryFlowCoordinator.setIdle()
            }
            await enterAuthenticated(context: .directAuthenticated)
        case .unauthenticatedSessionExpired:
            authDebug("AUTH_POST_AUTH_DEST", "unauthenticatedSessionExpired")
            recoveryFlowCoordinator.reset()
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            authState = .unauthenticated
        case .vaultCheckFailed:
            recoveryFlowCoordinator.reset()
            authDebug("AUTH_POST_AUTH_DEST", "vaultCheckFailed")
            authState = .needsPinEntry
        }
    }

    func transitionToAuthenticated() async {
        authState = .authenticated
        await syncCredentialsAfterAuth()
    }

    func enterAuthenticated(context: AuthCompletionContext) async {
        authDebug("AUTH_ENTER_AUTHENTICATED", "context=\(context.rawValue)")
        await transitionToAuthenticated()
        await runEnrollmentPipeline(
            context: context,
            hasActiveModal: recoveryFlowCoordinator.isModalActive
        )
    }

    func syncCredentialsAfterAuth() async {
        let syncOK = await biometric.syncAfterAuth()
        if !syncOK {
            toastManager.show(
                "La reconnaissance biométrique n'a pas pu être activée",
                type: .error
            )
        }
    }

    func runEnrollmentPipeline(context: AuthCompletionContext, hasActiveModal: Bool) async {
        enrollmentPolicy.resetForNewTransition()
        let decision = enrollmentPolicy.shouldAttempt(
            biometricEnabled: biometric.isEnabled,
            biometricCapable: biometric.canEnroll(),
            isAuthenticated: true,
            sourceEligible: context.allowsAutomaticEnrollment,
            hasActiveModal: hasActiveModal,
            context: context.reason
        )
        authDebug("AUTH_ENROLL", "decision=\(decision) context=\(context.reason) hasActiveModal=\(hasActiveModal)")
        guard case .proceed = decision else { return }
        authDebug(
            "AUTH_ENROLL",
            "proceeding bio=\(biometric.isEnabled) capable=\(biometric.canEnroll()) source=\(context.reason)"
        )
        enrollmentPolicy.markInFlight(context: context.reason)
        let enabled = await biometric.enable(source: .automatic, reason: context.reason)
        enrollmentPolicy.markComplete(context: context.reason, outcome: enabled ? .success : .deniedOrFailed)
    }

    /// Social users who never completed onboarding get redirected.
    /// For `.needsPinSetup`: no vault + no pending data = skipped onboarding (PUL-102).
    /// For `.needsPinEntry`/`.vaultCheckFailed`: uses `isIncompleteOnboarding` (mid-onboarding recovery).
    private func shouldRedirectToOnboarding(for destination: PostAuthDestination) -> Bool {
        switch destination {
        case .needsPinSetup:
            onboardingBootstrapper.pendingOnboardingData == nil
        case .needsPinEntry, .vaultCheckFailed:
            isIncompleteOnboarding
        default:
            false
        }
    }

    /// True when the user authenticated (e.g. social sign-in) but never completed onboarding.
    /// `pendingOnboardingData` is only set in `completeOnboarding`, so nil means onboarding
    /// was never finished. Combined with `!hasReturningUser` (email not yet saved to keychain),
    /// this reliably identifies a social user who killed the app mid-onboarding.
    private var isIncompleteOnboarding: Bool {
        returningUserFlagLoaded
            && onboardingBootstrapper.pendingOnboardingData == nil
            && !hasReturningUser
    }

    private func redirectToOnboardingForSocialUser() {
        authDebug("AUTH_POST_AUTH_DEST", "needsPinSetup → redirecting to onboarding (no pending data)")
        pendingSocialUser = currentUser
        hasReturningUser = false
        returningUserFlagLoaded = true
        authState = .unauthenticated
    }

    // MARK: - Social Auth for Onboarding (authenticate without routing)

    /// Authenticates with a social provider without triggering post-auth routing.
    /// Email is NOT saved to keychain — deferred to `completeOnboarding`.
    private func authenticateForOnboarding(
        tag: String,
        signIn: () async throws -> UserInfo
    ) async throws -> UserInfo {
        authDebug(tag, "begin")
        let user = try await signIn()
        clearPreLoginFlags()
        authDebug(tag, "complete — deferring routing to onboarding")
        return user
    }

    func authenticateWithApple(idToken: String, nonce: String) async throws -> UserInfo {
        try await authenticateForOnboarding(tag: "AUTH_SOCIAL_ONBOARDING_APPLE") {
            try await authService.signInWithApple(idToken: idToken, nonce: nonce)
        }
    }

    func authenticateWithGoogle(idToken: String, accessToken: String) async throws -> UserInfo {
        try await authenticateForOnboarding(tag: "AUTH_SOCIAL_ONBOARDING_GOOGLE") {
            try await authService.signInWithGoogle(idToken: idToken, accessToken: accessToken)
        }
    }

    // MARK: - Signup & Onboarding

    func enterSignupFlow() {
        authDebug("AUTH_SIGNUP", "entering signup flow")
        OnboardingState.clearPersistedData()
        onboardingBootstrapper.clearPendingData()
        pendingSocialUser = nil
        hasReturningUser = false
        returningUserFlagLoaded = true
    }

    func completeOnboarding(user: UserInfo, onboardingData: BudgetTemplateCreateFromOnboarding) async {
        authDebug("AUTH_ONBOARDING", "complete email=\(user.email.prefix(3))***")
        clearPreLoginFlags()
        currentUser = user
        await keychainManager.saveLastUsedEmail(user.email)
        hasReturningUser = true
        returningUserFlagLoaded = true
        onboardingBootstrapper.setPendingData(onboardingData)
        authState = .loading

        // Route based on actual vault status.
        // Handles reused emails where encryption keys already exist.
        let destination = await postAuthResolver.resolve()
        authDebug("AUTH_ONBOARDING", "destination=\(destination)")
        handleOnboardingDestination(destination)
    }

    func retryOnboardingPostAuth() async {
        authDebug("AUTH_ONBOARDING", "retrying post-auth")
        showPostAuthError = false
        let destination = await postAuthResolver.resolve()
        authDebug("AUTH_ONBOARDING", "retry destination=\(destination)")
        handleOnboardingDestination(destination)
    }

    func handleOnboardingDestination(_ destination: PostAuthDestination) {
        authDebug("AUTH_ONBOARDING_DEST", "destination=\(destination)")
        switch destination {
        case .needsPinSetup:
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            recoveryFlowCoordinator.setPendingConsent(needsRecoveryConsent)
            authState = .needsPinEntry
        case .authenticated:
            // Vault fully configured — verify existing PIN
            authState = .needsPinEntry
        case .unauthenticatedSessionExpired, .vaultCheckFailed:
            showPostAuthError = true
        }
    }

    // MARK: - PIN

    func completePinSetup() async {
        authDebug("AUTH_PIN_SETUP", "begin authState=\(authState)")
        guard authState == .needsPinSetup else { return }

        let success = await onboardingBootstrapper.bootstrapIfNeeded()
        if !success {
            // Retry once on transient failure (pending data is retained)
            _ = await onboardingBootstrapper.bootstrapIfNeeded()
        }
        authDebug("AUTH_PIN_SETUP", "bootstrap done, entering authenticated")
        await enterAuthenticated(context: .pinSetup)
    }

    func completePinEntry() async {
        authDebug("AUTH_PIN_ENTRY", "begin authState=\(authState)")
        guard authState == .needsPinEntry else { return }

        if recoveryFlowCoordinator.showConsentPromptIfPending() {
            authDebug("AUTH_PIN_ENTRY", "recovery consent pending, showing prompt")
            return
        }

        authDebug("AUTH_PIN_ENTRY", "no pending consent, entering authenticated")
        await enterAuthenticated(context: .pinEntry)
    }
}
