import Foundation
@testable import Pulpe
import Testing

/// Tests for BiometricAutomaticEnrollmentPolicy — the decision engine
/// that determines whether to auto-prompt FaceID after PIN entry.
@MainActor
@Suite(.serialized)
struct BiometricEnrollmentPolicyTests {
    private func makeSUT(optedOut: Bool = false) -> (BiometricAutomaticEnrollmentPolicy, InMemoryBiometricOptOutStore) {
        let store = AppStateTestFactory.biometricOptOutStore(optedOut: optedOut)
        let policy = BiometricAutomaticEnrollmentPolicy(optOutStore: store)
        return (policy, store)
    }

    // MARK: - Core: User explicitly disabled → never auto-enroll

    @Test("User explicitly disabled biometric → skip auto-enrollment")
    func userExplicitlyDisabled_skipsEnrollment() {
        let (sut, _) = makeSUT()
        sut.markUserExplicitlyDisabled()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "pin_entry"
        )

        #expect(decision == .skip(.userExplicitlyDisabled))
    }

    @Test("Persisted opt-out survives init — skip auto-enrollment on next launch")
    func persistedOptOut_skipsOnNextLaunch() {
        let (sut, _) = makeSUT(optedOut: true)

        let decision = sut.shouldAttempt(
            biometricEnabled: false, biometricCapable: true,
            isAuthenticated: true, sourceEligible: true,
            hasActiveModal: false, context: "pin_entry"
        )

        #expect(decision == .skip(.userExplicitlyDisabled),
                "Persisted opt-out must survive app restart")
    }

    @Test("markUserExplicitlyDisabled persists to store")
    func markDisabled_persistsToStore() {
        let (sut, store) = makeSUT()

        sut.markUserExplicitlyDisabled()

        #expect(store.lastSaved == true)
    }

    @Test("clearUserExplicitlyDisabled persists to store")
    func clearDisabled_persistsToStore() {
        let (sut, store) = makeSUT(optedOut: true)

        sut.clearUserExplicitlyDisabled()

        #expect(store.lastSaved == false)
    }

    @Test("User explicitly disabled then re-enabled → allow auto-enrollment")
    func userReEnabled_afterExplicitDisable_allowsEnrollment() {
        let (sut, _) = makeSUT()
        sut.markUserExplicitlyDisabled()
        sut.clearUserExplicitlyDisabled()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "pin_entry"
        )

        #expect(decision == .proceed)
    }

    // MARK: - Existing behavior preserved

    @Test("Never configured biometric + capable device → proceed")
    func neverConfigured_capable_proceeds() {
        let (sut, _) = makeSUT()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "pin_entry"
        )

        #expect(decision == .proceed)
    }

    @Test("Already enabled → skip")
    func alreadyEnabled_skips() {
        let (sut, _) = makeSUT()

        let decision = sut.shouldAttempt(
            biometricEnabled: true,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "pin_entry"
        )

        #expect(decision == .skip(.alreadyEnabled))
    }

    @Test("Not authenticated → skip")
    func notAuthenticated_skips() {
        let (sut, _) = makeSUT()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: false,
            sourceEligible: true,
            hasActiveModal: false,
            context: "pin_entry"
        )

        #expect(decision == .skip(.notAuthenticated))
    }

    @Test("Device not capable → skip")
    func notCapable_skips() {
        let (sut, _) = makeSUT()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: false,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "pin_entry"
        )

        #expect(decision == .skip(.capabilityUnavailable))
    }

    @Test("Source not eligible → skip")
    func sourceNotEligible_skips() {
        let (sut, _) = makeSUT()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: false,
            hasActiveModal: false,
            context: "direct_authenticated"
        )

        #expect(decision == .skip(.sourceNotEligible))
    }

    @Test("Modal active → skip")
    func modalActive_skips() {
        let (sut, _) = makeSUT()

        let decision = sut.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: true,
            context: "pin_entry"
        )

        #expect(decision == .skip(.modalActive))
    }

    @Test("Already attempted this transition → skip")
    func alreadyAttempted_skips() {
        let (sut, _) = makeSUT()
        sut.markInFlight(context: "pin_entry")
        sut.markComplete(context: "pin_entry", outcome: .deniedOrFailed)
        sut.resetForNewTransition()

        // First attempt after reset → proceed
        let first = sut.shouldAttempt(
            biometricEnabled: false, biometricCapable: true,
            isAuthenticated: true, sourceEligible: true,
            hasActiveModal: false, context: "pin_entry"
        )
        #expect(first == .proceed)

        sut.markInFlight(context: "pin_entry")
        sut.markComplete(context: "pin_entry", outcome: .deniedOrFailed)

        // Second attempt same transition → skip
        let second = sut.shouldAttempt(
            biometricEnabled: false, biometricCapable: true,
            isAuthenticated: true, sourceEligible: true,
            hasActiveModal: false, context: "pin_entry"
        )
        #expect(second == .skip(.alreadyAttempted))
    }
}
