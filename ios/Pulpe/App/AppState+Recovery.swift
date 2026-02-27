// MARK: - Recovery Flow

extension AppState {
    func startRecovery() {
        authDebug("AUTH_RECOVERY", "start authState=\(authState)")
        setManualBiometricRetryRequiredFlag(true)
        authState = .needsPinRecovery
    }

    func completeRecovery() async {
        authDebug("AUTH_RECOVERY", "complete authState=\(authState)")
        guard authState == .needsPinRecovery else { return }
        clearManualBiometricRetryRequiredFlag()
        await enterAuthenticated(context: .pinRecovery)
    }

    func cancelRecovery() {
        authDebug("AUTH_RECOVERY", "cancel authState=\(authState)")
        clearManualBiometricRetryRequiredFlag()
        authState = .needsPinEntry
    }

    func handleRecoverySessionExpired() async {
        authDebug("AUTH_RECOVERY", "sessionExpired isLoggingOut=\(isLoggingOut)")
        guard !isLoggingOut else { return }
        await clientKeyManager.clearSession()
        resetSession(.recoverySessionExpiry)
    }

    func acceptRecoveryKeyRepairConsent() async {
        authDebug("AUTH_RECOVERY_CONSENT", "accepted authState=\(authState)")
        let result = await recoveryFlowCoordinator.acceptConsent()
        authDebug("AUTH_RECOVERY_CONSENT", "result=\(result) authState=\(authState)")
        // Guard: abort if session was disrupted during the async operation.
        // Valid states: .authenticated (direct auth path) or .needsPinEntry (PIN + consent path).
        // Blocked: .loading (retry startup) or .unauthenticated (session expired).
        guard authState == .authenticated || authState == .needsPinEntry else { return }
        switch result {
        case .keyGenerated:
            break
        case .conflict:
            await enterAuthenticated(context: .recoveryKeyConflict)
        case .error:
            await enterAuthenticated(context: .recoveryKeyError)
        }
    }

    func declineRecoveryKeyRepairConsent() async {
        authDebug("AUTH_RECOVERY_CONSENT", "declined authState=\(authState)")
        recoveryFlowCoordinator.declineConsent()
        // Guard: abort if session was disrupted (same logic as accept)
        guard authState == .authenticated || authState == .needsPinEntry else { return }
        await enterAuthenticated(context: .recoveryKeyDeclined)
    }

    func completePostAuthRecoveryKeyPresentation() async {
        authDebug("AUTH_RECOVERY_KEY", "presentationDismissed authState=\(authState)")
        recoveryFlowCoordinator.completePresentationDismissal()
        // Guard: abort if session was disrupted (same logic as accept)
        guard authState == .authenticated || authState == .needsPinEntry else { return }
        await enterAuthenticated(context: .recoveryKeyPresented)
    }
}
