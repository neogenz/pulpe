import Foundation
@testable import Pulpe
import Testing

/// Tests that auth state-machine transitions enforce strict preconditions.
/// Each transition method must only proceed from its expected source state;
/// all other states must be treated as no-ops.
@MainActor
@Suite(.serialized)
struct AppStateStrictPreconditionTests {
    private let user = UserInfo(id: "precondition-user", email: "strict@pulpe.app", firstName: "Strict")

    // MARK: - SUT Factory

    private func makeSUT(
        destination: PostAuthDestination = .needsPinEntry(needsRecoveryKeyConsent: false),
        onAuthenticate: (@Sendable () async throws -> Void)? = nil
    ) -> AppState {
        let store = BiometricPreferenceStore(
            keychain: StubBiometricKeychain(initial: false),
            defaults: StubBiometricDefaults(initial: false)
        )
        return AppState(
            postAuthResolver: StubTransitionResolver(destination: destination),
            biometricPreferenceStore: store,
            biometricCapability: { true },
            biometricAuthenticate: onAuthenticate ?? { }
        )
    }

    // MARK: - completePinEntry: only valid from .needsPinEntry

    @Test("completePinEntry when .loading is a no-op")
    func completePinEntry_whenLoading_isNoOp() async {
        let sut = makeSUT()
        // Initial state is .loading
        #expect(sut.authState == .loading)

        await sut.completePinEntry()

        #expect(sut.authState == .loading)
    }

    @Test("completePinEntry when .unauthenticated is a no-op")
    func completePinEntry_whenUnauthenticated_isNoOp() async {
        let sut = makeSUT(destination: .unauthenticatedSessionExpired)

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .unauthenticated)

        await sut.completePinEntry()

        #expect(sut.authState == .unauthenticated)
    }

    @Test("completePinEntry when .needsPinSetup is a no-op")
    func completePinEntry_whenNeedsPinSetup_isNoOp() async {
        let sut = makeSUT(destination: .needsPinSetup)

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinSetup)

        await sut.completePinEntry()

        #expect(sut.authState == .needsPinSetup)
    }

    @Test("completePinEntry when .needsPinRecovery is a no-op")
    func completePinEntry_whenNeedsPinRecovery_isNoOp() async {
        let sut = makeSUT(destination: .needsPinEntry(needsRecoveryKeyConsent: false))

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        sut.startRecovery()
        #expect(sut.authState == .needsPinRecovery)

        await sut.completePinEntry()

        #expect(sut.authState == .needsPinRecovery)
    }

    // MARK: - completePinSetup: only valid from .needsPinSetup

    @Test("completePinSetup when .loading is a no-op")
    func completePinSetup_whenLoading_isNoOp() async {
        let sut = makeSUT()
        #expect(sut.authState == .loading)

        await sut.completePinSetup()

        #expect(sut.authState == .loading)
    }

    @Test("completePinSetup when .needsPinEntry is a no-op")
    func completePinSetup_whenNeedsPinEntry_isNoOp() async {
        let sut = makeSUT(destination: .needsPinEntry(needsRecoveryKeyConsent: false))

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        await sut.completePinSetup()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test("completePinSetup when .needsPinRecovery is a no-op")
    func completePinSetup_whenNeedsPinRecovery_isNoOp() async {
        let sut = makeSUT(destination: .needsPinEntry(needsRecoveryKeyConsent: false))

        await sut.resolvePostAuth(user: user)
        sut.startRecovery()
        #expect(sut.authState == .needsPinRecovery)

        await sut.completePinSetup()

        #expect(sut.authState == .needsPinRecovery)
    }

    // MARK: - completeRecovery: only valid from .needsPinRecovery

    @Test("completeRecovery when .loading is a no-op")
    func completeRecovery_whenLoading_isNoOp() async {
        let sut = makeSUT()
        #expect(sut.authState == .loading)

        await sut.completeRecovery()

        #expect(sut.authState == .loading)
    }

    @Test("completeRecovery when .needsPinEntry is a no-op")
    func completeRecovery_whenNeedsPinEntry_isNoOp() async {
        let sut = makeSUT(destination: .needsPinEntry(needsRecoveryKeyConsent: false))

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        await sut.completeRecovery()

        #expect(sut.authState == .needsPinEntry)
    }

    // MARK: - Direct authenticated path: no biometric enrollment

    @Test("resolvePostAuth .authenticated routes through pipeline without auto-enrollment")
    func directAuthRoute_passesUniquePipeline_noAutoEnrollment() async {
        let spy = AuthCallSpy()
        let sut = makeSUT(
            destination: .authenticated(needsRecoveryKeyConsent: false),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(await spy.callCount() == 0, "Direct authenticated path must not trigger biometric enrollment")
        #expect(sut.enrollmentPolicy.lastDecision == .skip(.sourceNotEligible))
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
