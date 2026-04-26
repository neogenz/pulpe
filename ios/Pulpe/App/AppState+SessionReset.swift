import OSLog
import Supabase
import SwiftUI

// MARK: - Session Lifecycle, Logout & Reset

extension AppState {
    // MARK: - Background & Foreground

    func handleEnterBackground() {
        authDebug("AUTH_BG", "entering background")
        sessionLifecycleCoordinator.handleEnterBackground()
    }

    func prepareForForeground() {
        authDebug("AUTH_FG_PREPARE", "authState=\(authState)")
        sessionLifecycleCoordinator.prepareForForeground(authState: authState)
    }

    func handleEnterForeground() async {
        defer { sessionLifecycleCoordinator.clearRestoringSession() }
        authDebug("AUTH_FG", "begin isRestoring=\(sessionLifecycleCoordinator.isRestoringSession)")

        if sessionLifecycleCoordinator.isRestoringSession {
            lastLockReason = .backgroundTimeout
        }

        let result = await sessionLifecycleCoordinator.handleEnterForeground(authState: authState)
        authDebug("AUTH_FG", "result=\(result)")

        switch result {
        case .noLockNeeded:
            break
        case .biometricUnlockSuccess:
            // Refresh Supabase session in background — token may have expired
            // during long background periods. Non-blocking: user sees the app
            // immediately, session refresh happens concurrently.
            backgroundRefreshTask?.cancel()
            let validate = validateRegularSession
            backgroundRefreshTask = Task(name: "AppState.backgroundRefresh") { [weak self] in
                defer { Task { @MainActor [weak self] in self?.backgroundRefreshTask = nil } }
                do {
                    let user = try await validate()
                    if user == nil {
                        guard !Task.isCancelled else { return }
                        Logger.auth.warning(
                            "handleEnterForeground: session refresh returned nil (no active session)"
                        )
                        await self?.logout(source: .system)
                    }
                } catch {
                    guard !Task.isCancelled else { return }
                    Logger.auth.warning(
                        "handleEnterForeground: session refresh failed - \(error)"
                    )
                    await self?.logout(source: .system)
                }
            }
            authDebug("AUTH_FG", "biometric unlock success, background refresh started")
        case .lockRequired, .staleKeyLockRequired:
            authDebug("AUTH_FG", "lock required, setting needsPinEntry")
            authState = .needsPinEntry
        }
    }

    func resetTips() {
        ProductTips.resetAllTips()
    }

    // MARK: - Stale Client Key

    func handleStaleClientKey() async {
        authDebug("AUTH_STALE_KEY", "triggered isLoggingOut=\(isLoggingOut) authState=\(authState)")
        guard !isLoggingOut, authState == .authenticated else { return }
        await clientKeyManager.clearAll()
        authState = .needsPinEntry
    }

    // MARK: - Session Expiry

    /// Called when APIClient detects an unrecoverable 401. AuthService.logout() was already
    /// called by APIClient — this method only resets local UI state.
    func handleSessionExpired() async {
        authDebug("AUTH_SESSION_EXPIRED", "triggered isLoggingOut=\(isLoggingOut)")
        guard !isLoggingOut else { return }
        await clientKeyManager.clearSession()
        resetSession(.sessionExpiry)
    }

    // MARK: - Logout

    func logout(
        source: LogoutSource = .userInitiated,
        preserveBiometricSession: Bool? = nil,
        scope: SignOutScope = .local
    ) async {
        guard !isLoggingOut else { return }
        isLoggingOut = true
        defer { isLoggingOut = false }
        authDebug("AUTH_LOGOUT", "begin source=\(source) biometricEnabled=\(biometric.isEnabled)")

        AnalyticsService.shared.capture(.logoutCompleted)
        AnalyticsService.shared.reset()

        backgroundRefreshTask?.cancel()
        backgroundRefreshTask = nil

        switch source {
        case .userInitiated:
            flagsStore.setDidExplicitLogout(true)
        case .system:
            clearExplicitLogoutFlag()
        }
        clearManualBiometricRetryRequiredFlag()

        let shouldPreserveBiometric = preserveBiometricSession ?? (source == .userInitiated)
        authDebug("AUTH_LOGOUT", "preserveBiometric=\(shouldPreserveBiometric)")
        if shouldPreserveBiometric && biometric.isEnabled {
            // Snapshot the live session into the biometric slot for cold-start re-entry.
            // PUL-132: removed `saveBiometricTokensFromKeychain` fallback — SDK storage
            // (PulpeAuthStorage) IS the source of truth, so a missing SDK session means
            // there's nothing valid to snapshot.
            var biometricTokensSaved = false
            do {
                try await authService.saveBiometricTokens()
                biometricTokensSaved = true
            } catch {
                Logger.auth.warning("logout: biometric snapshot failed - \(error)")
            }

            if biometricTokensSaved {
                // Clear local SDK state WITHOUT calling /logout (would revoke the refresh token)
                await authService.logoutKeepingBiometricSession()
            } else {
                // Both save attempts failed — biometric tokens are unusable.
                // Do a full logout instead of silently losing Face ID.
                Logger.auth.error("logout: biometric token preservation failed, doing full logout")
                await performSignOut(scope)
                await biometric.handleSessionExpired()
                biometric.isEnabled = false
            }
        } else {
            await performSignOut(scope)
            await biometric.handleSessionExpired()
            biometric.isEnabled = false
        }

        await clientKeyManager.clearSession()
        authDebug("AUTH_LOGOUT", "session cleared, resetting")
        resetSession(source == .userInitiated ? .userLogout : .systemLogout)
    }

    // MARK: - Password Reset

    /// Complete password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen.
    func completePasswordResetFlow() async {
        authDebug("AUTH_PASSWORD_RESET", "complete")
        // Password reset → revoke JWT server-side so a snapped access_token
        // cannot be replayed within its ~1h expiry window.
        await performSignOut(.global)
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometric.isEnabled = false
        resetSession(.passwordReset)
        toastManager.show("Mot de passe réinitialisé, reconnecte-toi", type: .success)
    }

    /// Cancel password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen without success feedback.
    func cancelPasswordResetFlow() async {
        authDebug("AUTH_PASSWORD_RESET", "cancel")
        // Cancel mid-recovery → revoke JWT server-side. Recovery session is
        // write-capable (can change password) so a snapped token must not survive.
        await performSignOut(.global)
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometric.isEnabled = false
        resetSession(.passwordReset)
    }

    // MARK: - Account Deletion

    func deleteAccount() async {
        do {
            _ = try await deleteAccountRequest()
        } catch {
            toastManager.show("La suppression du compte a échoué", type: .error)
            return
        }
        await clearLocalSignupState()
    }

    /// Discards an in-progress signup and returns the app to a clean welcome state
    /// without deleting the backend account.
    func abandonInProgressSignup() async {
        authDebug("AUTH_ABANDON", "begin")
        pendingOnboardingUser = nil
        await clearLocalSignupState()
        // Force `OnboardingFlow` to re-instantiate so its `@State` resets to
        // a fresh `OnboardingState` (reads the now-empty UserDefaults → welcome).
        onboardingSessionID = UUID()
        authDebug("AUTH_ABANDON", "complete")
    }

    /// Shared cleanup for both account deletion and in-progress signup abandon.
    /// Clears the returning-user footprint (keychain email, onboarding draft, flags)
    /// and logs out without preserving biometric session.
    private func clearLocalSignupState() async {
        await keychainManager.clearLastUsedEmail()
        enrollmentPolicy.clearUserExplicitlyDisabled()
        hasReturningUser = false
        returningUserFlagLoaded = true
        OnboardingState.clearPersistedData()
        onboardingBootstrapper.clearPendingData()
        clearManualBiometricRetryRequiredFlag()
        // Account deletion / signup abandon → revoke JWT server-side so a
        // snapped access_token cannot be replayed within its ~1h expiry window.
        await logout(source: .system, preserveBiometricSession: false, scope: .global)
    }

    // MARK: - Session Reset

    enum SessionResetScope {
        case userLogout
        case systemLogout
        case sessionExpiry
        case recoverySessionExpiry
        case passwordReset

        var clearsUIState: Bool {
            switch self {
            case .sessionExpiry: true
            default: true
            }
        }

        var clearsNavigation: Bool {
            switch self {
            case .userLogout, .systemLogout, .passwordReset: true
            default: false
            }
        }

        var clearsPostAuthError: Bool {
            switch self {
            case .userLogout, .systemLogout: true
            default: false
            }
        }

        var errorMessage: String? {
            switch self {
            case .sessionExpiry, .recoverySessionExpiry: "Ta session a expiré, reconnecte-toi"
            default: nil
            }
        }

        var setsManualBiometricRetry: Bool { self == .recoverySessionExpiry }
    }

    func resetSession(_ scope: SessionResetScope) {
        authDebug(
            "AUTH_RESET_SESSION",
            "scope=\(scope) clearsNav=\(scope.clearsNavigation) clearsUI=\(scope.clearsUIState)"
        )
        currentUser = nil
        authState = .unauthenticated
        biometricError = scope.errorMessage

        // Reset feature stores atomically with session state
        sessionDataResetter?.resetStores()

        if scope.clearsUIState {
            recoveryFlowCoordinator.reset()
            enrollmentPolicy.resetForNewTransition()
        }
        if scope.clearsPostAuthError { showPostAuthError = false }
        if scope.clearsNavigation {
            budgetPath = NavigationPath()
            templatePath = NavigationPath()
            selectedTab = .currentMonth
            widgetSyncing.clearAndReload()
        }
        if scope.setsManualBiometricRetry {
            setManualBiometricRetryRequiredFlag(true)
        }
    }

    // MARK: - Auth Flags Helpers

    func clearExplicitLogoutFlag() {
        flagsStore.clearExplicitLogoutFlag()
    }

    func setManualBiometricRetryRequiredFlag(_ required: Bool) {
        flagsStore.setManualBiometricRetryRequired(required)
    }

    func clearManualBiometricRetryRequiredFlag() {
        flagsStore.clearManualBiometricRetryFlag()
    }
}
