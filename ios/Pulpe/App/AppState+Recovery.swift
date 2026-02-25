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
        await enterAuthenticated(context: .recoveryKeyDeclined)
    }

    func completePostAuthRecoveryKeyPresentation() async {
        recoveryFlowCoordinator.completePresentationDismissal()
        await enterAuthenticated(context: .recoveryKeyPresented)
    }
}
