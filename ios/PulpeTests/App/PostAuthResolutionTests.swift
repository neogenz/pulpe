import Foundation
import Testing
@testable import Pulpe

@MainActor
struct PostAuthResolutionTests {
    private let user = UserInfo(id: "user-1", email: "test@pulpe.app", firstName: "Max")

    private func makeBiometricPreferenceStore(initial: Bool) -> BiometricPreferenceStore {
        BiometricPreferenceStore(
            keychain: StubBiometricPreferenceKeychain(initial: initial),
            defaults: StubBiometricPreferenceDefaults(initial: false)
        )
    }

    private func waitForBiometricPreferenceLoad(_ sut: AppState, expected: Bool) async {
        for _ in 0..<20 {
            if sut.biometricEnabled == expected {
                return
            }
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    private func waitForSilentBiometricSync(
        _ spy: SilentBiometricSyncSpy,
        expectedCalls: Int
    ) async {
        for _ in 0..<30 {
            if await spy.callCount() >= expectedCalls {
                return
            }
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    @Test("existing user routes to PIN entry")
    func existingUser_routesToPinEntry() async {
        let realResolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .success(VaultStatusResponse(pinCodeConfigured: true, recoveryKeyConfigured: true, vaultCodeConfigured: true))
            ]),
            sessionRefresher: StubSessionRefresher(result: false),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: nil)
        )
        let destination = await realResolver.resolve()
        #expect(destination == .needsPinEntry(needsRecoveryKeyConsent: false))

        let resolver = StubPostAuthResolver(destination: destination)
        let sut = AppState(postAuthResolver: resolver)

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.pinEntryAllowsBiometricUnlock == false)
        #expect(sut.showRecoveryKeyRepairConsent == false)
    }

    @Test("new or incomplete user routes to PIN setup")
    func newOrIncompleteUser_routesToPinSetup() async {
        let realResolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .success(VaultStatusResponse(pinCodeConfigured: false, recoveryKeyConfigured: false, vaultCodeConfigured: false))
            ]),
            sessionRefresher: StubSessionRefresher(result: false),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: nil)
        )
        let destination = await realResolver.resolve()
        #expect(destination == .needsPinSetup)

        let resolver = StubPostAuthResolver(destination: destination)
        let sut = AppState(postAuthResolver: resolver)

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .needsPinSetup)
    }

    @Test("inconsistent legacy user requires PIN entry and recovery consent")
    func inconsistentUser_requiresConsentAfterPinEntry() async {
        let realResolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .success(VaultStatusResponse(pinCodeConfigured: true, recoveryKeyConfigured: false, vaultCodeConfigured: false))
            ]),
            sessionRefresher: StubSessionRefresher(result: false),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: nil)
        )
        let destination = await realResolver.resolve()
        #expect(destination == .needsPinEntry(needsRecoveryKeyConsent: true))

        let resolver = StubPostAuthResolver(destination: destination)
        let sut = AppState(postAuthResolver: resolver)

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.pinEntryAllowsBiometricUnlock == false)
        #expect(sut.needsRecoveryKeyRepairConsent == true)
    }

    @Test("inconsistent legacy user with cached key still requires PIN entry first")
    func inconsistentUser_withCachedKeyStillRequiresPinEntry() async {
        let resolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .success(VaultStatusResponse(pinCodeConfigured: true, recoveryKeyConfigured: false, vaultCodeConfigured: false))
            ]),
            sessionRefresher: StubSessionRefresher(result: false),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: "cached-client-key")
        )

        let destination = await resolver.resolve()

        #expect(destination == .needsPinEntry(needsRecoveryKeyConsent: true))
    }

    @Test("recovery-only legacy status still requires PIN entry, even with cached key")
    func recoveryOnlyStatus_withCachedKey_requiresPinEntry() async {
        let resolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .success(VaultStatusResponse(pinCodeConfigured: false, recoveryKeyConfigured: true, vaultCodeConfigured: false))
            ]),
            sessionRefresher: StubSessionRefresher(result: false),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: "cached-client-key")
        )

        let destination = await resolver.resolve()

        #expect(destination == .needsPinEntry(needsRecoveryKeyConsent: false))
    }

    @Test("expired token during vault check refreshes once then succeeds")
    func vaultUnauthorized_refreshRetrySuccess() async {
        let resolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .failure(.unauthorized),
                .success(VaultStatusResponse(pinCodeConfigured: true, recoveryKeyConfigured: true, vaultCodeConfigured: true))
            ]),
            sessionRefresher: StubSessionRefresher(result: true),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: nil)
        )

        let destination = await resolver.resolve()

        #expect(destination == .needsPinEntry(needsRecoveryKeyConsent: false))
    }

    @Test("expired token during vault check returns session expired when retry fails")
    func vaultUnauthorized_refreshRetryFails() async {
        let resolver = PostAuthResolver(
            vaultStatusProvider: StubVaultStatusProvider(results: [
                .failure(.unauthorized)
            ]),
            sessionRefresher: StubSessionRefresher(result: false),
            clientKeyResolver: StubClientKeyResolver(resolvedKey: nil)
        )

        let destination = await resolver.resolve()

        #expect(destination == .unauthenticatedSessionExpired)
    }

    @Test("anti-flash: auth state stays loading while post-auth resolution is pending")
    func staysLoadingDuringPendingResolution() async {
        let resolver = DeferredPostAuthResolver()
        let sut = AppState(postAuthResolver: resolver)

        let task = Task {
            await sut.resolvePostAuth(user: user)
        }

        try? await Task.sleep(for: .milliseconds(30))
        #expect(sut.authState == .loading)

        resolver.resume(with: .needsPinEntry(needsRecoveryKeyConsent: false))
        await task.value

        #expect(sut.authState == .needsPinEntry)
    }

    @Test("existing user with Face ID enabled skips enrollment prompt")
    func existingUserWithBiometricEnabled_skipsEnrollmentPrompt() async {
        let resolver = StubPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        let sut = AppState(
            postAuthResolver: resolver,
            biometricPreferenceStore: makeBiometricPreferenceStore(initial: true),
            biometricCapability: { true }
        )

        await waitForBiometricPreferenceLoad(sut, expected: true)
        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.showBiometricEnrollment == false)
    }

    @Test("post-auth PIN entry disables biometric auto unlock, even when preference exists")
    func postAuthPinEntry_disablesBiometricAutoUnlock() async {
        let resolver = StubPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        let sut = AppState(
            postAuthResolver: resolver,
            biometricPreferenceStore: makeBiometricPreferenceStore(initial: true),
            biometricCapability: { true }
        )

        await waitForBiometricPreferenceLoad(sut, expected: true)
        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.pinEntryAllowsBiometricUnlock == false)
    }

    @Test("existing user without Face ID preference shows enrollment prompt")
    func existingUserWithoutBiometricPreference_showsEnrollmentPrompt() async {
        let resolver = StubPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        let sut = AppState(
            postAuthResolver: resolver,
            biometricPreferenceStore: makeBiometricPreferenceStore(initial: false),
            biometricCapability: { true }
        )

        await waitForBiometricPreferenceLoad(sut, expected: false)
        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.showBiometricEnrollment == true)
    }

    @Test("biometric enrollment acceptance triggers one OS prompt")
    func biometricEnrollment_acceptanceTriggersSingleOSPrompt() async {
        let resolver = StubPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false))
        let authSpy = BiometricAuthenticateSpy()
        let sut = AppState(
            postAuthResolver: resolver,
            biometricPreferenceStore: makeBiometricPreferenceStore(initial: false),
            biometricCapability: { true },
            biometricAuthenticate: {
                await authSpy.recordCall()
            }
        )

        await waitForBiometricPreferenceLoad(sut, expected: false)
        await sut.resolvePostAuth(user: user)
        #expect(sut.showBiometricEnrollment == true)

        _ = await sut.enableBiometric()

        #expect(await authSpy.callCount() == 1)
    }

    @Test("existing biometric preference silently refreshes credentials after PIN entry")
    func biometricPreferenceEnabled_silentRefreshAfterPinEntry() async {
        let resolver = StubPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        let syncSpy = SilentBiometricSyncSpy()
        let sut = AppState(
            postAuthResolver: resolver,
            biometricPreferenceStore: makeBiometricPreferenceStore(initial: true),
            syncBiometricCredentials: {
                await syncSpy.recordCallAndReturnTrue()
            }
        )

        await waitForBiometricPreferenceLoad(sut, expected: true)
        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        await waitForSilentBiometricSync(syncSpy, expectedCalls: 1)
        #expect(await syncSpy.callCount() == 1)
    }

    @Test("inconsistent authenticated path prioritizes recovery consent over biometric enrollment")
    func inconsistentAuthenticated_prioritizesRecoveryConsentPrompt() async {
        let resolver = StubPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: true))
        let sut = AppState(
            postAuthResolver: resolver,
            biometricPreferenceStore: makeBiometricPreferenceStore(initial: false),
            biometricCapability: { true }
        )

        await waitForBiometricPreferenceLoad(sut, expected: false)
        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.showRecoveryKeyRepairConsent == true)
        #expect(sut.showBiometricEnrollment == false)
    }

    @Test("checkAuthState waits for biometric preference hydration before decision")
    func checkAuthState_waitsForBiometricPreferenceHydration() async {
        let delayedKeychain = DelayedBiometricPreferenceKeychain(
            initial: true,
            delayMilliseconds: 80
        )
        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: delayedKeychain,
                defaults: StubBiometricPreferenceDefaults(initial: false)
            )
        )

        await sut.checkAuthState()

        #expect(sut.biometricEnabled == true)
    }
}

// MARK: - Stubs

private final class StubPostAuthResolver: PostAuthResolving, @unchecked Sendable {
    private let destination: PostAuthDestination

    init(destination: PostAuthDestination) {
        self.destination = destination
    }

    func resolve() async -> PostAuthDestination {
        destination
    }
}

private final class DeferredPostAuthResolver: PostAuthResolving, @unchecked Sendable {
    private var continuation: CheckedContinuation<PostAuthDestination, Never>?

    func resolve() async -> PostAuthDestination {
        await withCheckedContinuation { continuation in
            self.continuation = continuation
        }
    }

    func resume(with destination: PostAuthDestination) {
        continuation?.resume(returning: destination)
        continuation = nil
    }
}

private final class StubVaultStatusProvider: VaultStatusProviding, @unchecked Sendable {
    private var queue: [Result<VaultStatusResponse, APIError>]

    init(results: [Result<VaultStatusResponse, APIError>]) {
        self.queue = results
    }

    func getVaultStatus() async throws -> VaultStatusResponse {
        let next = queue.isEmpty ? .failure(.unknown(statusCode: -1)) : queue.removeFirst()
        switch next {
        case .success(let value):
            return value
        case .failure(let error):
            throw error
        }
    }
}

private struct StubSessionRefresher: SessionRefreshing {
    let result: Bool

    func refreshSessionForVaultCheck() async -> Bool {
        result
    }
}

private struct StubClientKeyResolver: ClientKeyResolving {
    let resolvedKey: String?

    func resolveClientKey() async -> String? {
        resolvedKey
    }
}

private actor BiometricAuthenticateSpy {
    private var calls = 0

    func recordCall() {
        calls += 1
    }

    func callCount() -> Int {
        calls
    }
}

private actor SilentBiometricSyncSpy {
    private var calls = 0

    func recordCallAndReturnTrue() -> Bool {
        calls += 1
        return true
    }

    func callCount() -> Int {
        calls
    }
}

private final actor StubBiometricPreferenceKeychain: BiometricPreferenceKeychainStoring {
    private var value: Bool?

    init(initial: Bool?) {
        value = initial
    }

    func getBiometricEnabledPreference() async -> Bool? {
        value
    }

    func saveBiometricEnabledPreference(_ enabled: Bool) async {
        value = enabled
    }
}

private final actor StubBiometricPreferenceDefaults: BiometricPreferenceDefaultsStoring {
    private var value: Bool

    init(initial: Bool) {
        value = initial
    }

    func getLegacyBiometricEnabled() async -> Bool {
        value
    }

    func removeLegacyBiometricEnabled() async {
        value = false
    }
}

private final actor DelayedBiometricPreferenceKeychain: BiometricPreferenceKeychainStoring {
    private var value: Bool?
    private let delayMilliseconds: UInt64

    init(initial: Bool?, delayMilliseconds: UInt64) {
        self.value = initial
        self.delayMilliseconds = delayMilliseconds
    }

    func getBiometricEnabledPreference() async -> Bool? {
        try? await Task.sleep(nanoseconds: delayMilliseconds * 1_000_000)
        return value
    }

    func saveBiometricEnabledPreference(_ enabled: Bool) async {
        value = enabled
    }
}
