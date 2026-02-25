import Foundation
@testable import Pulpe
import Testing

/// Non-regression tests locking down the interaction between recovery flow modals
/// and automatic biometric enrollment after the BiometricAutomaticEnrollmentPolicy refactor.
@MainActor
@Suite(.serialized)
struct AppStateModalBiometricInteractionTests {
    private let user = UserInfo(id: "modal-user", email: "modal@pulpe.app", firstName: "Modal")

    private func makeSUT(
        destination: PostAuthDestination = .needsPinEntry(needsRecoveryKeyConsent: false),
        onAuthenticate: (@Sendable () async throws -> Void)? = nil
    ) -> AppState {
        AppState(
            postAuthResolver: ModalStubResolver(destination: destination),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricKeychain(initial: false),
                defaults: StubBiometricDefaults(initial: false)
            ),
            biometricCapability: { true },
            biometricAuthenticate: onAuthenticate ?? { }
        )
    }

    // MARK: - Test 1: Single prompt after PIN entry

    @Test("enterAuthenticated after PIN entry triggers exactly one biometric authenticate call")
    func pinEntry_triggersExactlyOneAuthenticateCall() async {
        let spy = ModalAuthSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 1)
    }

    // MARK: - Test 2: Zero prompt while recovery consent is showing

    @Test("Zero biometric prompts while recoveryFlowState is consentPrompt")
    func recoveryConsentActive_skipsAutomaticEnrollment() async {
        let spy = ModalAuthSpy()
        let sut = makeSUT(
            destination: .authenticated(needsRecoveryKeyConsent: true),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(await spy.callCount() == 0, "No prompt while recovery consent modal is active")
    }

    // MARK: - Test 3: Zero prompt when recovery key sheet is presented

    @Test("Zero biometric prompts while recoveryFlowState is presentingKey")
    func recoveryKeySheetActive_skipsAutomaticEnrollment() async {
        let policy = BiometricAutomaticEnrollmentPolicy()
        policy.resetForNewTransition()

        let decision = policy.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: true,
            context: "test_modal_active"
        )

        if case .skip(let reason) = decision {
            #expect(reason == .modalActive)
        } else {
            Issue.record("Expected .skip(.modalActive) when hasActiveModal=true")
        }
    }

    // MARK: - Test 4: One prompt after recovery flow ends

    @Test("One biometric prompt after recovery consent declined and flow returns to idle")
    func recoveryConsentDeclined_triggersOnePromptAfterIdle() async {
        let spy = ModalAuthSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(await spy.callCount() == 0, "No prompt while consent shown")

        await sut.declineRecoveryKeyRepairConsent()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 1, "Exactly one prompt after recovery flow ends")
    }

    // MARK: - Test 5: Double trigger coalesced by inFlight guard

    @Test("Double rapid enterAuthenticated calls produce exactly one biometric authenticate call")
    func doubleTrigger_coalescedByInflightGuard() async throws {
        let spy = SlowModalAuthSpy()
        let sut = AppState(
            postAuthResolver: ModalStubResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricKeychain(initial: false),
                defaults: StubBiometricDefaults(initial: false)
            ),
            biometricCapability: { true },
            biometricAuthenticate: { await spy.recordAndWait() }
        )

        await sut.resolvePostAuth(user: user)
        try #require(sut.authState == .needsPinEntry)

        await withTaskGroup(of: Void.self) { group in
            group.addTask { await sut.completePinEntry() }
            group.addTask { await sut.completePinEntry() }
        }

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 1, "inFlight guard must coalesce concurrent triggers")
    }

    // MARK: - Test 6: Policy reset allows retry on next transition

    @Test("BiometricAutomaticEnrollmentPolicy resets on new transition allowing retry")
    func policyReset_allowsRetryOnNextTransition() {
        let policy = BiometricAutomaticEnrollmentPolicy()

        // Transition N: mark as in-flight and complete
        policy.resetForNewTransition()
        let firstDecision = policy.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "test_transition_n"
        )
        #expect(firstDecision == .proceed, "First attempt should proceed")

        policy.markInFlight(context: "test_transition_n")
        policy.markComplete(context: "test_transition_n", outcome: .deniedOrFailed)

        // Without reset: should skip (already attempted this transition)
        let sameTransitionDecision = policy.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "test_same_transition"
        )
        if case .skip(let reason) = sameTransitionDecision {
            #expect(reason == .alreadyAttempted)
        } else {
            Issue.record("Expected .skip(.alreadyAttempted) without reset")
        }

        // Transition N+1: reset allows retry
        policy.resetForNewTransition()
        let nextTransitionDecision = policy.shouldAttempt(
            biometricEnabled: false,
            biometricCapable: true,
            isAuthenticated: true,
            sourceEligible: true,
            hasActiveModal: false,
            context: "test_transition_n_plus_1"
        )
        #expect(nextTransitionDecision == .proceed, "After reset, next transition should proceed")
    }
}

// MARK: - Local Stubs

private struct ModalStubResolver: PostAuthResolving {
    let destination: PostAuthDestination
    func resolve() async -> PostAuthDestination { destination }
}

private actor ModalAuthSpy {
    private var calls = 0
    func record() { calls += 1 }
    func callCount() -> Int { calls }
}

private actor SlowModalAuthSpy {
    private var calls = 0
    func recordAndWait() async {
        calls += 1
        try? await Task.sleep(for: .milliseconds(50))
    }
    func callCount() -> Int { calls }
}
