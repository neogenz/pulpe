// MARK: - Recovery Flow

extension AppState {
    func startRecovery() {
        setManualBiometricRetryRequiredFlag(true)
        authState = .needsPinRecovery
    }

    func completeRecovery() async {
        guard authState == .needsPinRecovery else { return }
        clearManualBiometricRetryRequiredFlag()
        await enterAuthenticated(context: .pinRecovery)
    }

    func cancelRecovery() {
        clearManualBiometricRetryRequiredFlag()
        authState = .needsPinEntry
    }

    func handleRecoverySessionExpired() async {
        guard !isLoggingOut else { return }
        await clientKeyManager.clearSession()
        resetSession(.recoverySessionExpiry)
    }

    func acceptRecoveryKeyRepairConsent() async {
        let result = await recoveryFlowCoordinator.acceptConsent()
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
        recoveryFlowCoordinator.declineConsent()
        // Guard: abort if session was disrupted (same logic as accept)
        guard authState == .authenticated || authState == .needsPinEntry else { return }
        await enterAuthenticated(context: .recoveryKeyDeclined)
    }

    func completePostAuthRecoveryKeyPresentation() async {
        recoveryFlowCoordinator.completePresentationDismissal()
        // Guard: abort if session was disrupted (same logic as accept)
        guard authState == .authenticated || authState == .needsPinEntry else { return }
        await enterAuthenticated(context: .recoveryKeyPresented)
    }
}
