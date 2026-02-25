import Foundation
@testable import Pulpe
import Testing

@MainActor
@Suite(.serialized)
struct AuthenticatedEntryCoordinatorTests {
    // MARK: - Test Doubles
    struct CoordinatorFactoryResult {
        let coordinator: AuthenticatedEntryCoordinator
        let biometric: BiometricManager
        let policy: BiometricAutomaticEnrollmentPolicy
        let toast: ToastManager
    }

    private func makeCoordinator(
        biometricEnabled: Bool = false,
        capability: Bool = true,
        onAuthenticate: (@Sendable () async throws -> Void)? = nil,
        syncResult: Bool = true
    ) -> CoordinatorFactoryResult {
        let store = BiometricPreferenceStore(
            keychain: StubBiometricKeychain(initial: biometricEnabled),
            defaults: StubBiometricDefaults(initial: false)
        )
        let biometric = BiometricManager(
            preferenceStore: store,
            authService: .shared,
            clientKeyManager: .shared,
            capability: { capability },
            authenticate: onAuthenticate ?? { },
            syncCredentials: { syncResult },
            resolveKey: { nil },
            validateKey: { _ in false }
        )
        let policy = BiometricAutomaticEnrollmentPolicy()
        let toast = ToastManager()
        let coordinator = AuthenticatedEntryCoordinator(
            biometric: biometric,
            enrollmentPolicy: policy,
            toastManager: toast
        )
        return CoordinatorFactoryResult(
            coordinator: coordinator,
            biometric: biometric,
            policy: policy,
            toast: toast
        )
    }

    // MARK: - syncCredentials

    @Test("syncCredentials when biometric disabled is a no-op (no toast)")
    func syncCredentials_biometricDisabled_noToast() async {
        let (coordinator, _, _, toast) = makeCoordinator(biometricEnabled: false)

        await coordinator.syncCredentials()

        #expect(toast.currentToast == nil)
    }

    @Test("syncCredentials with failed sync shows error toast")
    func syncCredentials_failure_showsToast() async {
        let (coordinator, biometric, _, toast) = makeCoordinator(biometricEnabled: true, syncResult: false)
        await biometric.loadPreference()

        await coordinator.syncCredentials()

        #expect(toast.currentToast != nil)
    }

    // MARK: - runEnrollmentPipeline

    @Test("runEnrollmentPipeline with pinSetup context attempts enrollment")
    func runEnrollmentPipeline_pinSetup_attemptsEnrollment() async {
        let spy = CoordinatorAuthSpy()
        let (coordinator, _, policy, _) = makeCoordinator(onAuthenticate: { await spy.record() })

        await coordinator.runEnrollmentPipeline(
            context: AppState.AuthCompletionContext.pinSetup,
            hasActiveModal: false
        )

        #expect(await spy.callCount() == 1)
        #expect(policy.lastDecision == .proceed)
    }

    @Test("runEnrollmentPipeline with directAuthenticated context skips enrollment")
    func runEnrollmentPipeline_directAuthenticated_skipsEnrollment() async {
        let spy = CoordinatorAuthSpy()
        let (coordinator, _, policy, _) = makeCoordinator(onAuthenticate: { await spy.record() })

        await coordinator.runEnrollmentPipeline(
            context: AppState.AuthCompletionContext.directAuthenticated,
            hasActiveModal: false
        )

        #expect(await spy.callCount() == 0)
        #expect(policy.lastDecision == .skip(.sourceNotEligible))
    }

    @Test("runEnrollmentPipeline with active modal skips enrollment")
    func runEnrollmentPipeline_activeModal_skipsEnrollment() async {
        let spy = CoordinatorAuthSpy()
        let (coordinator, _, policy, _) = makeCoordinator(onAuthenticate: { await spy.record() })

        await coordinator.runEnrollmentPipeline(
            context: AppState.AuthCompletionContext.pinEntry,
            hasActiveModal: true
        )

        #expect(await spy.callCount() == 0)
        #expect(policy.lastDecision == .skip(.modalActive))
    }

    @Test("runEnrollmentPipeline with biometric already enabled skips enrollment")
    func runEnrollmentPipeline_alreadyEnabled_skipsEnrollment() async {
        let spy = CoordinatorAuthSpy()
        let (coordinator, biometric, policy, _) = makeCoordinator(
            biometricEnabled: true,
            onAuthenticate: { await spy.record() }
        )
        await biometric.loadPreference()

        await coordinator.runEnrollmentPipeline(
            context: AppState.AuthCompletionContext.pinEntry,
            hasActiveModal: false
        )

        #expect(await spy.callCount() == 0)
        #expect(policy.lastDecision == .skip(.alreadyEnabled))
    }

    @Test("runEnrollmentPipeline without capability skips enrollment")
    func runEnrollmentPipeline_noCapability_skipsEnrollment() async {
        let spy = CoordinatorAuthSpy()
        let (coordinator, _, policy, _) = makeCoordinator(
            capability: false,
            onAuthenticate: { await spy.record() }
        )

        await coordinator.runEnrollmentPipeline(
            context: AppState.AuthCompletionContext.pinEntry,
            hasActiveModal: false
        )

        #expect(await spy.callCount() == 0)
        #expect(policy.lastDecision == .skip(.capabilityUnavailable))
    }

    @Test("runEnrollmentPipeline resets policy on each call")
    func runEnrollmentPipeline_resetsPolicy() async {
        struct DenialError: Error {}
        let spy = CoordinatorAuthSpy()
        let (coordinator, _, policy, _) = makeCoordinator(onAuthenticate: {
            await spy.record()
            throw DenialError()
        })

        // First call: enrollment attempted and denied
        await coordinator.runEnrollmentPipeline(context: .pinEntry, hasActiveModal: false)
        #expect(await spy.callCount() == 1)

        // Second call: policy resets so enrollment is retried
        await coordinator.runEnrollmentPipeline(context: .pinEntry, hasActiveModal: false)
        #expect(await spy.callCount() == 2, "Policy must reset between calls allowing retry")
    }

    @Test("runEnrollmentPipeline marks in-flight during enrollment")
    func runEnrollmentPipeline_marksInFlight() async {
        let policy = BiometricAutomaticEnrollmentPolicy()
        var wasInFlight = false
        let store = BiometricPreferenceStore(
            keychain: StubBiometricKeychain(initial: false),
            defaults: StubBiometricDefaults(initial: false)
        )
        let biometric = BiometricManager(
            preferenceStore: store,
            authService: .shared,
            clientKeyManager: .shared,
            capability: { true },
            authenticate: { await MainActor.run { wasInFlight = policy.inFlight } },
            syncCredentials: { true },
            resolveKey: { nil },
            validateKey: { _ in false }
        )
        let coordinator = AuthenticatedEntryCoordinator(
            biometric: biometric,
            enrollmentPolicy: policy,
            toastManager: ToastManager()
        )

        await coordinator.runEnrollmentPipeline(
            context: AppState.AuthCompletionContext.pinSetup,
            hasActiveModal: false
        )

        #expect(wasInFlight, "Policy should be in-flight during enrollment")
        #expect(!policy.inFlight, "Policy should not be in-flight after completion")
    }
}

// MARK: - Local Stubs

private actor CoordinatorAuthSpy {
    private var calls = 0
    func record() { calls += 1 }
    func callCount() -> Int { calls }
}
