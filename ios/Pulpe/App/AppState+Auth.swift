// MARK: - Auth (Login, Post-Auth Routing, Onboarding, PIN)

extension AppState {
    func login(email: String, password: String) async throws {
        // NOTE: Do NOT set authState = .loading here.
        // LoginView handles its own loading state. Setting authState = .loading
        // would cause SwiftUI to unmount LoginView (showing LoadingView), then
        // remount it on error — causing a jarring close/reopen animation.

        let user = try await authService.login(email: email, password: password)
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
        await keychainManager.saveLastUsedEmail(email)
        hasReturningUser = true
        returningUserFlagLoaded = true
        await resolvePostAuth(user: user)
    }

    func loginWithBiometric() async {
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
        await applyColdStartResult(
            sessionLifecycleCoordinator.attemptBiometricSessionValidation()
        )
    }

    /// After Supabase session is valid, route deterministically to setup/entry/app.
    func resolvePostAuth(user: UserInfo) async {
        let destination = await postAuthResolver.resolve()
        await applyPostAuthDestination(destination, user: user)
    }

    func applyPostAuthDestination(_ destination: PostAuthDestination, user: UserInfo? = nil) async {
        if let user {
            currentUser = user
        }
        authState = .loading

        switch destination {
        case .needsPinSetup:
            authDebug("AUTH_POST_AUTH_DEST", "needsPinSetup")
            recoveryFlowCoordinator.reset()
            authState = .needsPinSetup
        case .needsPinEntry(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "needsPinEntry")
            recoveryFlowCoordinator.setPendingConsent(needsRecoveryConsent)
            authState = .needsPinEntry
        case .authenticated(let needsRecoveryConsent):
            authDebug("AUTH_POST_AUTH_DEST", "authenticated")
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
            authDebug("AUTH_POST_AUTH_DEST", "vaultCheckFailed")
            // Safe fallback for existing users: assume PIN entry.
            recoveryFlowCoordinator.reset()
            authState = .needsPinEntry
        }
    }

    func transitionToAuthenticated() async {
        authState = .authenticated
        await syncCredentialsAfterAuth()
    }

    func enterAuthenticated(context: AuthCompletionContext) async {
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
        guard case .proceed = decision else { return }
        enrollmentPolicy.markInFlight(context: context.reason)
        let enabled = await biometric.enable(source: .automatic, reason: context.reason)
        enrollmentPolicy.markComplete(context: context.reason, outcome: enabled ? .success : .deniedOrFailed)
    }

    // MARK: - Signup & Onboarding

    func enterSignupFlow() {
        OnboardingState.clearPersistedData()
        onboardingBootstrapper.clearPendingData()
        hasReturningUser = false
        returningUserFlagLoaded = true
    }

    func completeOnboarding(user: UserInfo, onboardingData: BudgetTemplateCreateFromOnboarding) async {
        clearExplicitLogoutFlag()
        clearManualBiometricRetryRequiredFlag()
        currentUser = user
        await keychainManager.saveLastUsedEmail(user.email)
        hasReturningUser = true
        returningUserFlagLoaded = true
        onboardingBootstrapper.setPendingData(onboardingData)
        authState = .loading

        // Route based on actual vault status.
        // Handles reused emails where encryption keys already exist.
        let destination = await postAuthResolver.resolve()
        handleOnboardingDestination(destination)
    }

    func retryOnboardingPostAuth() async {
        showPostAuthError = false
        let destination = await postAuthResolver.resolve()
        handleOnboardingDestination(destination)
    }

    func handleOnboardingDestination(_ destination: PostAuthDestination) {
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
        guard authState == .needsPinSetup else { return }

        await onboardingBootstrapper.bootstrapIfNeeded()
        await enterAuthenticated(context: .pinSetup)
    }

    func completePinEntry() async {
        guard authState == .needsPinEntry else { return }

        if recoveryFlowCoordinator.showConsentPromptIfPending() {
            return
        }

        await enterAuthenticated(context: .pinEntry)
    }
}
