import Foundation
@testable import Pulpe
import Testing

/// Tests for the `send()` event pipeline routing in `AppState+FlowState.swift`.
///
/// Verifies that events are correctly dispatched through the three processing tiers:
/// 1. **Immediate** (synchronous): `recoveryInitiated`, `recoveryCancelled`
/// 2. **Reducer** (pure state transition): `maintenanceChecked`, `networkBecameUnavailable`,
///    `startupTimedOut`, `foregroundLockRequired`, `foregroundNoLockNeeded`, `biometricUnlockFailed`
/// 3. **Async** (serialized via `eventQueue`): everything else
@Suite(.serialized)
@MainActor
struct AppFlowEventRoutingTests {
    private let testUser = UserInfo(id: "routing-user", email: "routing@pulpe.app", firstName: "Routing")

    // MARK: - Helpers

    /// Creates an AppState in `.initializing` (default) state.
    private func makeSUT() -> AppState {
        AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            syncBiometricCredentials: { false },
            resolveBiometricKey: { nil }
        )
    }

    /// Creates an AppState that is fully authenticated.
    private func makeAuthenticatedSUT() async -> AppState {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            syncBiometricCredentials: { false },
            resolveBiometricKey: { nil }
        )
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
        return sut
    }

    /// Creates an AppState in locked (needsPinEntry) state.
    private func makeLockedSUT() async -> AppState {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            syncBiometricCredentials: { false },
            resolveBiometricKey: { nil }
        )
        await sut.resolvePostAuth(user: testUser)
        return sut
    }

    // MARK: - Reducer-Tier Events (synchronous via send())

    @Test("send(.startupTimedOut) from initializing transitions via reducer")
    func startupTimedOut_fromInitializing_transitionsToNetworkUnavailable() {
        let sut = makeSUT()
        #expect(sut.flowState == .initializing)

        sut.send(.startupTimedOut)

        #expect(sut.flowState == .networkUnavailable(retryable: true))
        #expect(sut.isNetworkUnavailable == true)
    }

    @Test("send(.maintenanceChecked(true)) from initializing transitions via reducer")
    func maintenanceCheckedTrue_fromInitializing_transitionsToMaintenance() {
        let sut = makeSUT()
        #expect(sut.flowState == .initializing)

        sut.send(.maintenanceChecked(isInMaintenance: true))

        #expect(sut.flowState == .maintenance)
        #expect(sut.isInMaintenance == true)
    }

    @Test("send(.maintenanceChecked(false)) from maintenance transitions via reducer")
    func maintenanceCheckedFalse_fromMaintenance_transitionsToInitializing() {
        let sut = makeSUT()
        sut.isInMaintenance = true
        #expect(sut.flowState == .maintenance)

        sut.send(.maintenanceChecked(isInMaintenance: false))

        #expect(sut.flowState == .initializing)
        #expect(sut.isInMaintenance == false)
    }

    @Test("send(.networkBecameUnavailable) from initializing transitions via reducer")
    func networkBecameUnavailable_fromInitializing_transitionsToNetworkUnavailable() {
        let sut = makeSUT()
        #expect(sut.flowState == .initializing)

        sut.send(.networkBecameUnavailable)

        #expect(sut.flowState == .networkUnavailable(retryable: true))
        #expect(sut.isNetworkUnavailable == true)
    }

    @Test("send(.foregroundLockRequired) from authenticated transitions via reducer")
    func foregroundLockRequired_fromAuthenticated_transitionsToLocked() async {
        let sut = await makeAuthenticatedSUT()
        #expect(sut.flowState == .authenticated)

        sut.send(.foregroundLockRequired)

        #expect(sut.authState == .needsPinEntry)
    }

    @Test("send(.biometricUnlockFailed) from locked stays locked")
    func biometricUnlockFailed_fromLocked_staysLocked() async {
        let sut = await makeLockedSUT()
        #expect(sut.authState == .needsPinEntry)

        sut.send(.biometricUnlockFailed)

        // biometricUnlockFailed returns nil from reducer (no-op transition),
        // so it stays in needsPinEntry
        #expect(sut.authState == .needsPinEntry)
    }

    // MARK: - Immediate-Tier Events

    @Test("send(.recoveryInitiated) calls startRecovery()")
    func recoveryInitiated_callsStartRecovery() async {
        let sut = await makeLockedSUT()
        #expect(sut.authState == .needsPinEntry)

        sut.send(.recoveryInitiated)

        #expect(sut.authState == .needsPinRecovery)
    }

    @Test("send(.recoveryCancelled) calls cancelRecovery()")
    func recoveryCancelled_callsCancelRecovery() async {
        let sut = await makeLockedSUT()
        sut.send(.recoveryInitiated)
        #expect(sut.authState == .needsPinRecovery)

        sut.send(.recoveryCancelled)

        #expect(sut.authState == .needsPinEntry)
    }

    // MARK: - No-Op / Invalid Transitions

    @Test("send(.pinEntrySucceeded) from unauthenticated is no-op")
    func pinEntrySucceeded_fromUnauthenticated_isNoOp() async {
        let sut = makeSUT()
        sut.authState = .unauthenticated

        sut.send(.pinEntrySucceeded)

        // Allow async queue processing to complete
        try? await Task.sleep(for: .milliseconds(100))

        #expect(sut.authState == .unauthenticated)
    }

    @Test("send(.foregroundLockRequired) from unauthenticated is no-op")
    func foregroundLockRequired_fromUnauthenticated_isNoOp() {
        let sut = makeSUT()
        sut.authState = .unauthenticated

        sut.send(.foregroundLockRequired)

        // Reducer returns nil for this invalid transition, event is not enqueued
        #expect(sut.authState == .unauthenticated)
    }

    @Test("send(.startupTimedOut) from authenticated is no-op")
    func startupTimedOut_fromAuthenticated_isNoOp() async {
        let sut = await makeAuthenticatedSUT()
        #expect(sut.authState == .authenticated)

        sut.send(.startupTimedOut)

        // Reducer returns nil for startupTimedOut when not in initializing state
        #expect(sut.authState == .authenticated)
    }

    // MARK: - Async-Tier Events (via eventQueue)

    @Test("send(.logoutRequested) from authenticated transitions to unauthenticated")
    func logoutRequested_fromAuthenticated_transitionsToUnauthenticated() async {
        let sut = await makeAuthenticatedSUT()
        #expect(sut.authState == .authenticated)

        sut.send(.logoutRequested(source: .userInitiated))

        await waitForCondition("authState should become unauthenticated") {
            sut.authState == .unauthenticated
        }
    }

    @Test("send(.sessionExpired) from authenticated transitions to unauthenticated")
    func sessionExpired_fromAuthenticated_transitionsToUnauthenticated() async {
        let sut = await makeAuthenticatedSUT()
        #expect(sut.authState == .authenticated)

        sut.send(.sessionExpired)

        await waitForCondition("authState should become unauthenticated") {
            sut.authState == .unauthenticated
        }
    }

    @Test("send(.pinEntrySucceeded) from locked transitions to authenticated")
    func pinEntrySucceeded_fromLocked_transitionsToAuthenticated() async {
        let sut = await makeLockedSUT()
        #expect(sut.authState == .needsPinEntry)

        sut.send(.pinEntrySucceeded)

        await waitForCondition("authState should become authenticated") {
            sut.authState == .authenticated
        }
    }

    @Test("send(.recoveryCompleted) from needsPinRecovery transitions to authenticated")
    func recoveryCompleted_fromRecovery_transitionsToAuthenticated() async {
        let sut = await makeLockedSUT()
        sut.send(.recoveryInitiated)
        #expect(sut.authState == .needsPinRecovery)

        sut.send(.recoveryCompleted)

        await waitForCondition("authState should become authenticated") {
            sut.authState == .authenticated
        }
    }

    @Test("send(.recoveryKeyPresentationDismissed) from authenticated stays authenticated")
    func recoveryKeyDismissed_fromAuthenticated_staysAuthenticated() async {
        let sut = await makeAuthenticatedSUT()
        #expect(sut.authState == .authenticated)

        sut.send(.recoveryKeyPresentationDismissed)

        // Allow async processing to complete
        try? await Task.sleep(for: .milliseconds(100))

        #expect(sut.authState == .authenticated)
    }

    @Test("send(.recoverySessionExpired) from needsPinRecovery transitions to unauthenticated")
    func recoverySessionExpired_fromRecovery_transitionsToUnauthenticated() async {
        let sut = await makeLockedSUT()
        sut.send(.recoveryInitiated)
        #expect(sut.authState == .needsPinRecovery)

        sut.send(.recoverySessionExpired)

        await waitForCondition("authState should become unauthenticated") {
            sut.authState == .unauthenticated
        }
    }

    // MARK: - Reducer-Tier Prevents Async Processing

    @Test("reducer-tier events are synchronous and do not hit async queue")
    func reducerTierEvents_areSynchronous() {
        let sut = makeSUT()
        #expect(sut.flowState == .initializing)

        // These are all reducer-tier events: they should complete synchronously
        sut.send(.startupTimedOut)
        #expect(sut.isNetworkUnavailable == true)

        // Reset state
        sut.isNetworkUnavailable = false
        sut.authState = .loading
        #expect(sut.flowState == .initializing)

        sut.send(.maintenanceChecked(isInMaintenance: true))
        #expect(sut.isInMaintenance == true)

        // Verify maintenance -> initializing
        sut.send(.maintenanceChecked(isInMaintenance: false))
        #expect(sut.isInMaintenance == false)
        #expect(sut.authState == .loading)
    }
}
