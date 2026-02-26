import OSLog

/// Coordinates the recovery key consent and generation flow.
/// Owns the `RecoveryFlowState` state machine and `pendingRecoveryConsent` flag.
@Observable
@MainActor
final class RecoveryFlowCoordinator {
    // MARK: - Result type for consent acceptance
    enum ConsentResult: Equatable {
        case keyGenerated
        case conflict
        case error
    }

    // MARK: - State

    private(set) var recoveryFlowState: AppState.RecoveryFlowState = .idle
    private var pendingRecoveryConsent = false

    // MARK: - Computed Properties

    var isRecoveryConsentVisible: Bool {
        recoveryFlowState == .consentPrompt
    }

    var isRecoveryKeySheetVisible: Bool {
        if case .presentingKey = recoveryFlowState { return true }
        return false
    }

    var recoveryKeyForPresentation: String? {
        if case .presentingKey(let key) = recoveryFlowState { return key }
        return nil
    }

    var isModalActive: Bool {
        recoveryFlowState.isModalActive
    }

    // MARK: - Dependencies

    @ObservationIgnored private let setupRecoveryKey: @Sendable () async throws -> String
    @ObservationIgnored private let toastManager: ToastManager

    init(encryptionAPI: EncryptionAPI, toastManager: ToastManager) {
        self.setupRecoveryKey = { try await encryptionAPI.setupRecoveryKey() }
        self.toastManager = toastManager
    }

    init(setupRecoveryKey: @escaping @Sendable () async throws -> String, toastManager: ToastManager) {
        self.setupRecoveryKey = setupRecoveryKey
        self.toastManager = toastManager
    }

    // MARK: - Consent Lifecycle

    func setPendingConsent(_ value: Bool) {
        pendingRecoveryConsent = value
    }

    /// If a pending consent exists, transitions to `.consentPrompt` and returns `true`.
    /// Otherwise returns `false`.
    func showConsentPromptIfPending() -> Bool {
        guard pendingRecoveryConsent else { return false }
        recoveryFlowState = .consentPrompt
        return true
    }

    func setConsentPrompt() {
        recoveryFlowState = .consentPrompt
    }

    func setIdle() {
        recoveryFlowState = .idle
    }

    // MARK: - Consent Actions

    func acceptConsent() async -> ConsentResult {
        recoveryFlowState = .generatingKey
        pendingRecoveryConsent = false

        do {
            let recoveryKey = try await setupRecoveryKey()
            recoveryFlowState = .presentingKey(recoveryKey)
            return .keyGenerated
        } catch let error as APIError {
            if case .conflict = error {
                Logger.auth.info("acceptConsent: recovery key already exists, continue")
                recoveryFlowState = .idle
                return .conflict
            }

            Logger.auth.error("acceptConsent: setup-recovery failed - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            recoveryFlowState = .idle
            return .error
        } catch {
            Logger.auth.error("acceptConsent: unexpected setup-recovery error - \(error)")
            toastManager.show("Impossible de générer la clé de récupération", type: .error)
            recoveryFlowState = .idle
            return .error
        }
    }

    func declineConsent() {
        recoveryFlowState = .idle
        pendingRecoveryConsent = false
    }

    func completePresentationDismissal() {
        recoveryFlowState = .idle
        pendingRecoveryConsent = false
    }

    // MARK: - Reset

    func reset() {
        recoveryFlowState = .idle
        pendingRecoveryConsent = false
    }
}
