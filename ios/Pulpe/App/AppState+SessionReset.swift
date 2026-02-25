import OSLog
import SwiftUI

// MARK: - Session Lifecycle, Logout & Reset

extension AppState {
    // MARK: - Background & Foreground

    func handleEnterBackground() {
        sessionLifecycleCoordinator.handleEnterBackground()
    }

    func prepareForForeground() {
        sessionLifecycleCoordinator.prepareForForeground(authState: authState)
    }

    func handleEnterForeground() async {
        defer { sessionLifecycleCoordinator.clearRestoringSession() }

        let result = await sessionLifecycleCoordinator.handleEnterForeground(authState: authState)

        switch result {
        case .noLockNeeded:
            break
        case .biometricUnlockSuccess:
            // Refresh Supabase session in background — token may have expired
            // during long background periods. Non-blocking: user sees the app
            // immediately, session refresh happens concurrently.
            backgroundRefreshTask?.cancel()
            let validate = validateRegularSession
            backgroundRefreshTask = Task { [weak self] in
                defer { Task { @MainActor [weak self] in self?.backgroundRefreshTask = nil } }
                do {
                    _ = try await validate()
                } catch {
                    guard !Task.isCancelled else { return }
                    Logger.auth.warning(
                        "handleEnterForeground: session refresh failed - \(error)"
                    )
                    await self?.logout(source: .system)
                }
            }
        case .lockRequired, .staleKeyLockRequired:
            authState = .needsPinEntry
        }
    }

    func resetTips() {
        ProductTips.resetAllTips()
    }

    // MARK: - Stale Client Key

    func handleStaleClientKey() async {
        guard !isLoggingOut, authState == .authenticated else { return }
        await clientKeyManager.clearAll()
        authState = .needsPinEntry
    }

    // MARK: - Session Expiry

    /// Called when APIClient detects an unrecoverable 401. AuthService.logout() was already
    /// called by APIClient — this method only resets local UI state.
    func handleSessionExpired() async {
        guard !isLoggingOut else { return }
        await clientKeyManager.clearSession()
        resetSession(.sessionExpiry)
    }

    // MARK: - Logout

    func logout(source: LogoutSource = .userInitiated) async {
        guard !isLoggingOut else { return }
        isLoggingOut = true
        defer { isLoggingOut = false }

        backgroundRefreshTask?.cancel()
        backgroundRefreshTask = nil

        switch source {
        case .userInitiated:
            flagsStore.setDidExplicitLogout(true)
        case .system:
            clearExplicitLogoutFlag()
        }

        if biometric.isEnabled {
            // Refresh biometric tokens with the latest session before clearing
            var biometricTokensSaved = false
            do {
                try await authService.saveBiometricTokens()
                biometricTokensSaved = true
            } catch {
                Logger.auth.warning("logout: SDK session unavailable, falling back to keychain - \(error)")
                biometricTokensSaved = await authService.saveBiometricTokensFromKeychain()
            }

            if biometricTokensSaved {
                // Clear local SDK state WITHOUT calling /logout (would revoke the refresh token)
                await authService.logoutKeepingBiometricSession()
            } else {
                // Both save attempts failed — biometric tokens are unusable.
                // Do a full logout instead of silently losing Face ID.
                Logger.auth.error("logout: biometric token preservation failed, doing full logout")
                await authService.logout()
                biometric.isEnabled = false
            }
        } else {
            await authService.logout()
        }

        await clientKeyManager.clearSession()
        resetSession(source == .userInitiated ? .userLogout : .systemLogout)
    }

    // MARK: - Password Reset

    /// Complete password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen.
    func completePasswordResetFlow() async {
        await authService.logout()
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometric.isEnabled = false
        resetSession(.passwordReset)
        toastManager.show("Mot de passe réinitialisé, reconnecte-toi", type: .success)
    }

    /// Cancel password recovery flow by clearing temporary auth/encryption state
    /// and returning the app to the regular login screen without success feedback.
    func cancelPasswordResetFlow() async {
        await authService.logout()
        await authService.clearBiometricTokens()
        await clientKeyManager.clearAll()
        biometric.isEnabled = false
        resetSession(.passwordReset)
    }

    // MARK: - Account Deletion

    func deleteAccount() async {
        do {
            _ = try await authService.deleteAccount()
        } catch {
            toastManager.show("La suppression du compte a échoué", type: .error)
            return
        }

        await keychainManager.clearLastUsedEmail()
        hasReturningUser = false
        returningUserFlagLoaded = true
        OnboardingState.clearPersistedData()
        onboardingBootstrapper.clearPendingData()
        clearManualBiometricRetryRequiredFlag()
        await logout(source: .system)
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
            case .sessionExpiry: false
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
        currentUser = nil
        authState = .unauthenticated
        biometricError = scope.errorMessage

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
