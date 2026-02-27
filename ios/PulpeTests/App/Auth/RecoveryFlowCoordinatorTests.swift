import Foundation
@testable import Pulpe
import Testing

@MainActor
@Suite(.serialized)
struct RecoveryFlowCoordinatorTests {
    // MARK: - SUT Factory
    private func makeCoordinator(
        setupRecoveryKey: (@Sendable () async throws -> String)? = nil
    ) -> (coordinator: RecoveryFlowCoordinator, toast: ToastManager) {
        let toast = ToastManager()
        let coordinator = RecoveryFlowCoordinator(
            setupRecoveryKey: setupRecoveryKey ?? { "DEFAULT-KEY" },
            toastManager: toast
        )
        return (coordinator, toast)
    }

    // MARK: - Initial State

    @Test("Initial state is idle with no pending consent")
    func initialState_isIdle() {
        let (sut, _) = makeCoordinator()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.isRecoveryConsentVisible == false)
        #expect(sut.isRecoveryKeySheetVisible == false)
        #expect(sut.recoveryKeyForPresentation == nil)
        #expect(sut.isModalActive == false)
    }

    // MARK: - Pending Consent Lifecycle

    @Test("setPendingConsent(true) then showConsentPromptIfPending transitions to consentPrompt")
    func pendingConsent_showIfPending_transitionsToConsentPrompt() {
        let (sut, _) = makeCoordinator()

        sut.setPendingConsent(true)
        let shown = sut.showConsentPromptIfPending()

        #expect(shown == true)
        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(sut.isRecoveryConsentVisible == true)
        #expect(sut.isModalActive == true)
    }

    @Test("showConsentPromptIfPending without pending consent returns false")
    func showConsentPromptIfPending_noPending_returnsFalse() {
        let (sut, _) = makeCoordinator()

        let shown = sut.showConsentPromptIfPending()

        #expect(shown == false)
        #expect(sut.recoveryFlowState == .idle)
    }

    @Test("setPendingConsent(false) prevents showConsentPromptIfPending from showing")
    func setPendingConsentFalse_preventsShow() {
        let (sut, _) = makeCoordinator()

        sut.setPendingConsent(true)
        sut.setPendingConsent(false)
        let shown = sut.showConsentPromptIfPending()

        #expect(shown == false)
        #expect(sut.recoveryFlowState == .idle)
    }

    // MARK: - setConsentPrompt / setIdle

    @Test("setConsentPrompt transitions to consentPrompt")
    func setConsentPrompt_transitionsToConsentPrompt() {
        let (sut, _) = makeCoordinator()

        sut.setConsentPrompt()

        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(sut.isRecoveryConsentVisible == true)
    }

    @Test("setIdle transitions to idle")
    func setIdle_transitionsToIdle() {
        let (sut, _) = makeCoordinator()

        sut.setConsentPrompt()
        sut.setIdle()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.isRecoveryConsentVisible == false)
    }

    // MARK: - acceptConsent: Success

    @Test("acceptConsent success transitions to presentingKey and returns .keyGenerated")
    func acceptConsent_success_transitionsToPresentingKey() async {
        let (sut, _) = makeCoordinator(
            setupRecoveryKey: { "TEST-KEY-1234" }
        )
        sut.setConsentPrompt()

        let result = await sut.acceptConsent()

        #expect(result == .keyGenerated)
        if case .presentingKey(let key) = sut.recoveryFlowState {
            #expect(key == "TEST-KEY-1234")
        } else {
            Issue.record("Expected .presentingKey, got \(sut.recoveryFlowState)")
        }
        #expect(sut.isRecoveryKeySheetVisible == true)
        #expect(sut.recoveryKeyForPresentation == "TEST-KEY-1234")
        #expect(sut.isModalActive == true)
    }

    // MARK: - acceptConsent: Conflict

    @Test("acceptConsent with conflict returns .conflict and resets to idle")
    func acceptConsent_conflict_returnsConflict() async {
        let (sut, _) = makeCoordinator(
            setupRecoveryKey: { throw APIError.conflict(message: "already exists") }
        )
        sut.setConsentPrompt()

        let result = await sut.acceptConsent()

        #expect(result == .conflict)
        #expect(sut.recoveryFlowState == .idle)
    }

    // MARK: - acceptConsent: Error

    @Test("acceptConsent with API error returns .error, shows toast, and resets to idle")
    func acceptConsent_apiError_returnsErrorWithToast() async {
        let (sut, toast) = makeCoordinator(
            setupRecoveryKey: { throw APIError.serverError(message: "Internal Server Error") }
        )
        sut.setConsentPrompt()

        let result = await sut.acceptConsent()

        #expect(result == .error)
        #expect(sut.recoveryFlowState == .idle)
        #expect(toast.currentToast != nil)
    }

    @Test("acceptConsent with unexpected error returns .error, shows toast, and resets to idle")
    func acceptConsent_unexpectedError_returnsErrorWithToast() async {
        struct UnexpectedError: Error {}
        let (sut, toast) = makeCoordinator(
            setupRecoveryKey: { throw UnexpectedError() }
        )
        sut.setConsentPrompt()

        let result = await sut.acceptConsent()

        #expect(result == .error)
        #expect(sut.recoveryFlowState == .idle)
        #expect(toast.currentToast != nil)
    }

    // MARK: - declineConsent

    @Test("declineConsent from consentPrompt resets to idle and clears pending")
    func declineConsent_fromConsentPrompt_resetsToIdle() {
        let (sut, _) = makeCoordinator()

        sut.setPendingConsent(true)
        _ = sut.showConsentPromptIfPending()
        #expect(sut.recoveryFlowState == .consentPrompt)

        sut.declineConsent()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.isRecoveryConsentVisible == false)
        // Pending consent should also be cleared
        #expect(sut.showConsentPromptIfPending() == false)
    }

    // MARK: - completePresentationDismissal

    @Test("completePresentationDismissal resets from presentingKey to idle")
    func completePresentationDismissal_resetsToIdle() async {
        let (sut, _) = makeCoordinator(
            setupRecoveryKey: { "KEY-FOR-DISMISS" }
        )
        sut.setConsentPrompt()

        _ = await sut.acceptConsent()
        #expect(sut.isRecoveryKeySheetVisible == true)

        sut.completePresentationDismissal()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.isRecoveryKeySheetVisible == false)
        #expect(sut.recoveryKeyForPresentation == nil)
    }

    // MARK: - reset

    @Test("reset clears all state back to idle")
    func reset_clearsAllState() {
        let (sut, _) = makeCoordinator()

        sut.setPendingConsent(true)
        sut.setConsentPrompt()

        sut.reset()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.isRecoveryConsentVisible == false)
        #expect(sut.showConsentPromptIfPending() == false)
    }

    // MARK: - isModalActive for each state

    @Test("isModalActive is false for idle, true for consentPrompt/generatingKey/presentingKey")
    func isModalActive_correctForEachState() async {
        let (sut, _) = makeCoordinator(
            setupRecoveryKey: { "MODAL-KEY" }
        )

        // idle
        #expect(sut.isModalActive == false)

        // consentPrompt
        sut.setConsentPrompt()
        #expect(sut.isModalActive == true)

        // generatingKey -> presentingKey (acceptConsent transitions through both)
        let result = await sut.acceptConsent()
        #expect(result == .keyGenerated)
        #expect(sut.isModalActive == true)

        // back to idle
        sut.completePresentationDismissal()
        #expect(sut.isModalActive == false)
    }

    // MARK: - Computed properties for each state

    @Test("isRecoveryConsentVisible is true only for consentPrompt")
    func isRecoveryConsentVisible_onlyForConsentPrompt() {
        let (sut, _) = makeCoordinator()

        #expect(sut.isRecoveryConsentVisible == false) // idle

        sut.setConsentPrompt()
        #expect(sut.isRecoveryConsentVisible == true) // consentPrompt

        sut.setIdle()
        #expect(sut.isRecoveryConsentVisible == false) // back to idle
    }

    @Test("isRecoveryKeySheetVisible is true only for presentingKey")
    func isRecoveryKeySheetVisible_onlyForPresentingKey() async {
        let (sut, _) = makeCoordinator(
            setupRecoveryKey: { "SHEET-KEY" }
        )

        #expect(sut.isRecoveryKeySheetVisible == false) // idle

        sut.setConsentPrompt()
        #expect(sut.isRecoveryKeySheetVisible == false) // consentPrompt

        _ = await sut.acceptConsent()
        #expect(sut.isRecoveryKeySheetVisible == true) // presentingKey
    }

    // MARK: - Operation ID Invalidation

    @Test("acceptConsent no-ops if reset() invalidates during generation")
    func acceptConsent_resetDuringGeneration_noOps() async {
        let operationStarted = AtomicFlag()
        let continueOperation = AtomicFlag()

        let (sut, _) = makeCoordinator(
            setupRecoveryKey: {
                operationStarted.set()
                while !continueOperation.value {
                    try await Task.sleep(for: .milliseconds(10))
                }
                return "test-key"
            }
        )
        sut.setConsentPrompt()

        let task = Task { await sut.acceptConsent() }
        await waitForCondition(
            timeout: .milliseconds(500),
            "operation must start"
        ) {
            operationStarted.value
        }

        // Reset invalidates the in-flight operation
        sut.reset()
        #expect(sut.recoveryFlowState == .idle)

        // Allow the blocked closure to complete
        continueOperation.set()
        let result = await task.value

        // Stale callback must be discarded
        #expect(result == .error)
        #expect(sut.recoveryFlowState == .idle)
    }

    @Test("second acceptConsent invalidates first in-flight operation")
    func acceptConsent_doubleCall_secondInvalidatesFirst() async {
        let firstStarted = AtomicFlag()
        let continueFirst = AtomicFlag()
        let callCount = AtomicProperty<Int>(0)

        let (sut, _) = makeCoordinator(
            setupRecoveryKey: {
                let call = callCount.value
                callCount.increment()
                if call == 0 {
                    firstStarted.set()
                    while !continueFirst.value {
                        try await Task.sleep(for: .milliseconds(10))
                    }
                    return "first-key"
                }
                return "second-key"
            }
        )
        sut.setConsentPrompt()

        // Launch first call — blocks inside setupRecoveryKey
        let firstTask = Task { await sut.acceptConsent() }
        await waitForCondition(
            timeout: .milliseconds(500),
            "first operation must start"
        ) {
            firstStarted.value
        }

        // Second call creates a new operationId, invalidating the first
        let secondTask = Task { await sut.acceptConsent() }
        let secondResult = await secondTask.value

        // Unblock the first call so it can return
        continueFirst.set()
        let firstResult = await firstTask.value

        // Second call wins; first is invalidated
        #expect(firstResult == .error)
        #expect(secondResult == .keyGenerated)
        if case .presentingKey(let key) = sut.recoveryFlowState {
            #expect(key == "second-key")
        } else {
            Issue.record(
                "Expected .presentingKey, got \(sut.recoveryFlowState)"
            )
        }
    }

    @Test("declineConsent during generation invalidates in-flight operation")
    func declineConsent_duringGeneration_invalidatesOperation() async {
        let operationStarted = AtomicFlag()
        let continueOperation = AtomicFlag()

        let (sut, _) = makeCoordinator(
            setupRecoveryKey: {
                operationStarted.set()
                while !continueOperation.value {
                    try await Task.sleep(for: .milliseconds(10))
                }
                return "test-key"
            }
        )
        sut.setConsentPrompt()

        let task = Task { await sut.acceptConsent() }
        await waitForCondition(
            timeout: .milliseconds(500),
            "operation must start"
        ) {
            operationStarted.value
        }

        // Decline invalidates the in-flight operation
        sut.declineConsent()
        #expect(sut.recoveryFlowState == .idle)

        // Allow the blocked closure to complete
        continueOperation.set()
        let result = await task.value

        // Stale callback must be discarded
        #expect(result == .error)
        #expect(sut.recoveryFlowState == .idle)
    }
}
