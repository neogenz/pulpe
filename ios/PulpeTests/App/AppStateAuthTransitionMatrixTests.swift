import Foundation
@testable import Pulpe
import Testing

/// Transition-matrix tests for the auth/biometric auto-enrollment pipeline.
/// Establishes a green baseline BEFORE any refactoring.
/// Each test targets one cell in the matrix: (trigger × biometric state × capability) → expected outcome.
@MainActor
@Suite(.serialized)
struct AppStateAuthTransitionMatrixTests {
    private let user = UserInfo(id: "matrix-user", email: "matrix@pulpe.app", firstName: "Matrix")

    private func makeSUT(
        destination: PostAuthDestination = .needsPinEntry(needsRecoveryKeyConsent: false),
        biometricEnabled: Bool = false,
        capability: Bool = true,
        onAuthenticate: (@Sendable () async throws -> Void)? = nil
    ) -> AppState {
        let store = BiometricPreferenceStore(
            keychain: StubBiometricKeychain(initial: biometricEnabled),
            defaults: StubBiometricDefaults(initial: false)
        )
        return AppState(
            postAuthResolver: StubTransitionResolver(destination: destination),
            biometricPreferenceStore: store,
            biometricCapability: { capability },
            biometricAuthenticate: onAuthenticate ?? { }
        )
    }

    // MARK: - Matrix Row 0: Direct authenticated path skips enrollment via pipeline

    @Test("resolvePostAuth .authenticated traverses pipeline but skips enrollment (source not eligible)")
    func directAuthenticated_traversesPipeline_skipsEnrollment() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .authenticated(needsRecoveryKeyConsent: false),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 0, "No enrollment on direct authenticated path")
        #expect(sut.enrollmentPolicy.lastDecision == .skip(.sourceNotEligible))
    }

    @Test("resolvePostAuth .authenticated with recovery consent shows consent and skips enrollment")
    func directAuthenticated_withRecoveryConsent_showsConsentAndSkipsEnrollment() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .authenticated(needsRecoveryKeyConsent: true),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(await spy.callCount() == 0, "No enrollment on direct authenticated path")
        #expect(sut.enrollmentPolicy.lastDecision == .skip(.sourceNotEligible))
    }

    // MARK: - Matrix Row 1: PIN success, no recovery consent

    @Test("PIN success without recovery consent fires auto-enrollment exactly once")
    func pinSuccess_noRecovery_firesAutoEnrollmentOnce() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 1)
    }

    // MARK: - Matrix Row 2: PIN success with recovery consent visible

    @Test("PIN success with recovery consent blocks auto-enrollment during modal")
    func pinSuccess_withRecoveryConsent_blocksAutoEnrollmentDuringModal() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        await sut.completePinEntry()

        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(await spy.callCount() == 0, "No auto-enrollment while recovery consent modal is visible")
    }

    // MARK: - Matrix Row 3: End recovery flow → auto-enrollment fires

    @Test("Declining recovery consent triggers auto-enrollment once")
    func declineRecoveryConsent_triggersAutoEnrollmentOnce() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(await spy.callCount() == 0)

        await sut.declineRecoveryKeyRepairConsent()

        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .idle)
        #expect(await spy.callCount() == 1)
    }

    @Test("Completing PIN recovery triggers auto-enrollment once")
    func completeRecovery_triggersAutoEnrollmentOnce() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        sut.startRecovery()
        #expect(sut.authState == .needsPinRecovery)

        await sut.completeRecovery()

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 1)
    }

    // MARK: - Matrix Row 4: Auto-enrollment denied → no re-prompt within same transition

    @Test("Concurrent enrollment triggers within same transition do not double-prompt")
    func autoEnrollment_concurrentWithinSameTransition_noDuplicatePrompt() async {
        struct DenialError: Error {}
        let spy = SlowAuthCallSpy()
        let sut = AppState(
            postAuthResolver: StubTransitionResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricKeychain(initial: false),
                defaults: StubBiometricDefaults(initial: false)
            ),
            biometricCapability: { true },
            biometricAuthenticate: {
                await spy.recordAndWait()
                throw DenialError()
            }
        )

        await sut.resolvePostAuth(user: user)

        // Two concurrent completePinEntry calls in the same transition group
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await sut.completePinEntry() }
            group.addTask { await sut.completePinEntry() }
        }

        #expect(sut.authState == .authenticated)
        // The per-transition policy (inFlight guard) ensures only one prompt fires
        // even if two concurrent completePinEntry calls both trigger enterAuthenticated
        let count = await spy.callCount()
        #expect(count == 1, "Concurrent triggers must produce exactly one prompt")
    }

    // MARK: - Matrix Row 5: Auto-enrollment denied → manual still possible

    @Test("Automatic enrollment denial still allows manual activation")
    func autoEnrollmentDenied_manualActivationStillWorks() async {
        struct DenialError: Error {}
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: {
                await spy.record()
                throw DenialError()
            }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(await spy.callCount() == 1, "Auto-enrollment attempted and failed")

        // Manual enable still triggers the prompt (even though it throws here)
        _ = await sut.enableBiometric()

        #expect(await spy.callCount() == 2, "Manual enrollment must still prompt after auto denial")
    }

    // MARK: - Matrix Row 6: No biometric capability

    @Test("Device without biometric capability skips auto-enrollment silently")
    func noCapability_skipsAutoEnrollment_noCrash() async {
        let spy = AuthCallSpy()
        let sut = AppState(
            postAuthResolver: StubTransitionResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricKeychain(initial: false),
                defaults: StubBiometricDefaults(initial: false)
            ),
            biometricCapability: { false },
            biometricAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 0, "No auto-enrollment when device lacks biometric capability")
    }

    // MARK: - Matrix Row 7: Concurrent triggers → single prompt

    @Test("Two concurrent PIN completions coalesce to a single auto-enrollment prompt")
    func concurrentTriggers_coalesceSinglePrompt() async throws {
        let spy = SlowAuthCallSpy()
        let sut = AppState(
            postAuthResolver: StubTransitionResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
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
        #expect(await spy.callCount() == 1, "Concurrent triggers must produce only one OS prompt")
    }

    // MARK: - Matrix Row 8: Cold start with biometric enabled (non-regression)

    @Test("Cold start with biometric already enabled skips auto-enrollment")
    func coldStart_biometricAlreadyEnabled_skipsAutoEnrollment() async {
        let spy = AuthCallSpy()
        let sut = AppState(
            postAuthResolver: StubTransitionResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: StubBiometricKeychain(initial: true),
                defaults: StubBiometricDefaults(initial: false)
            ),
            biometricCapability: { true },
            biometricAuthenticate: { await spy.record() }
        )

        // Wait for preference load
        await waitForCondition(timeout: .milliseconds(500), "Biometric preference should load") {
            sut.biometricEnabled == true
        }

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 0, "Already-enrolled users must not be re-prompted")
    }

    // MARK: - Matrix Row 9: Refusal → retry on next transition
    // Per-transition policy: automatic enrollment resets on each new auth completion event.

    @Test("Auto-enrollment denied on session N retries on session N+1 (per-transition policy)")
    func autoEnrollmentDenied_sessionN_retriesSessionNPlusOne() async {
        struct DenialError: Error {}
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: {
                await spy.record()
                throw DenialError()
            }
        )

        // Session N: PIN success, auto-enrollment denied
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        #expect(await spy.callCount() == 1)

        // Simulate logout + re-login (new session N+1)
        await sut.logout(source: .system)
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        // Per-transition policy resets on each enterAuthenticated call → retry allowed
        #expect(await spy.callCount() == 2, "Per-transition policy allows retry on subsequent session")
    }
}

// MARK: - Local Stubs

private struct StubTransitionResolver: PostAuthResolving {
    let destination: PostAuthDestination
    func resolve() async -> PostAuthDestination { destination }
}

private actor AuthCallSpy {
    private var calls = 0

    func record() { calls += 1 }
    func callCount() -> Int { calls }
}

private actor SlowAuthCallSpy {
    private var calls = 0

    func recordAndWait() async {
        calls += 1
        try? await Task.sleep(for: .milliseconds(50))
    }

    func callCount() -> Int { calls }
}
