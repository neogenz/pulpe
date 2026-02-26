import Foundation
@testable import Pulpe
import Testing

/// Tests for lock reason derivation and recovery consent race conditions.
///
/// Gap 3 (fixed): `lastLockReason` is now stored explicitly on `AppState`, set to
/// `.backgroundTimeout` in `handleEnterForeground` before the defer clears `isRestoringSession`.
///
/// Gap 4: Recovery late-callback not robust against mid-startup race.
/// The guard in `acceptRecoveryKeyRepairConsent` is
/// `guard authState != .unauthenticated else { return }`.
/// If session expires (authState -> .unauthenticated) and then retry starts
/// (authState -> .loading), the guard passes because authState == .loading,
/// allowing a late callback to fire against mid-startup state.
@Suite(.serialized)
@MainActor
struct AppStateLockReasonTests {
    private let testUser = UserInfo(id: "lock-reason-user", email: "lock-reason@pulpe.app", firstName: "LockReason")
    private let pinResolver = MockPostAuthResolver(
        destination: .needsPinEntry(needsRecoveryKeyConsent: false)
    )

    /// Transition SUT through the state machine to `.authenticated` via PIN entry.
    private func authenticateViaPinEntry(_ sut: AppState) async {
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
    }

    // MARK: - Gap 3: backgroundTimeout Lock Reason Is Unreachable

    @Test("Foreground return beyond grace period should produce flowState .locked(.backgroundTimeout)")
    func foregroundReturn_beyondGracePeriod_flowStateIsLockedBackgroundTimeout() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false },
            syncBiometricCredentials: { false },
            resolveBiometricKey: { nil },
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)
        #expect(sut.authState == .authenticated)

        // Go to background and exceed grace period
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Exceeds 30s grace period
        sut.prepareForForeground()
        #expect(sut.isRestoringSession == true)

        // handleEnterForeground will transition to needsPinEntry
        // but defer clears isRestoringSession before we can read flowState
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)

        // After the fix, lastLockReason persists .backgroundTimeout even after
        // isRestoringSession is cleared by the defer in handleEnterForeground.
        #expect(sut.flowState == .locked(.backgroundTimeout))
    }

    @Test("Cold start should produce flowState .locked(.coldStart) (baseline)")
    func coldStart_flowStateIsLockedColdStart() {
        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )
        sut.authState = .needsPinEntry
        // isRestoringSession is false by default (cold start)

        // This should pass: cold start always produces .coldStart
        #expect(sut.flowState == .locked(.coldStart))
    }

    @Test("Lock reason should not change without an explicit foreground event")
    func lockReason_doesNotFlipWithoutExplicitEvent() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false },
            syncBiometricCredentials: { false },
            resolveBiometricKey: { nil },
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        // Simulate background + exceed grace period but only prepareForForeground
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()

        // At this point isRestoringSession is true, but authState is still .authenticated
        // so flowState is .authenticated (not .locked at all)
        #expect(sut.isRestoringSession == true)
        #expect(sut.authState == .authenticated)
        #expect(sut.flowState == .authenticated)

        // Only after handleEnterForeground should the state transition to locked
        // But due to the defer, we lose the background timeout reason
        await sut.handleEnterForeground()
        #expect(sut.authState == .needsPinEntry)

        // After handleEnterForeground, isRestoringSession is always false,
        // making .backgroundTimeout permanently unreachable via flowState
        #expect(sut.isRestoringSession == false)

        // After the fix, lastLockReason persists .backgroundTimeout.
        #expect(sut.flowState == .locked(.backgroundTimeout))
    }

    // MARK: - Gap 4: Recovery Consent Late-Callback Race Condition

    @Test("Recovery consent error during session expiry then retry startup should not corrupt state")
    func recoveryConsent_sessionExpiryDuringAsync_thenRetryStartup_noStateCorruption() async {
        // The gap: acceptRecoveryKeyRepairConsent() guards with
        // `guard authState != .unauthenticated`, but if session expires (.unauthenticated)
        // and then retry starts (.loading), the guard passes because .loading != .unauthenticated.
        // When setupRecoveryKey throws (returning .error), the code calls
        // enterAuthenticated(context: .recoveryKeyError), corrupting mid-startup state.
        let operationStarted = AtomicFlag()
        let continueOperation = AtomicFlag()

        struct RecoverySetupError: Error {}

        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: true)),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false },
            setupRecoveryKey: {
                operationStarted.set()
                // Block until we signal to continue (simulates slow recovery key generation)
                while !continueOperation.value {
                    try await Task.sleep(for: .milliseconds(10))
                }
                // Throw a non-conflict error so acceptConsent returns .error,
                // which triggers enterAuthenticated(context: .recoveryKeyError)
                throw RecoverySetupError()
            }
        )

        let user = UserInfo(id: "race-user", email: "race@pulpe.app", firstName: "Race")
        await sut.resolvePostAuth(user: user)
        #expect(sut.isRecoveryConsentVisible == true)
        #expect(sut.authState == .authenticated)

        // Start the consent acceptance in background (this is async, will block on setupRecoveryKey)
        let acceptTask = Task {
            await sut.acceptRecoveryKeyRepairConsent()
        }

        // Wait for the recovery key operation to start
        await waitForCondition(timeout: .milliseconds(500), "operation must start") {
            operationStarted.value
        }

        // Session expires mid-operation
        await sut.handleSessionExpired()
        #expect(sut.authState == .unauthenticated)

        // Simulate retry startup: authState goes back to .loading
        sut.authState = .loading

        // Now allow the blocked recovery key operation to complete with an error.
        // acceptConsent() will return .error, and then the guard
        // `guard authState != .unauthenticated` will be evaluated.
        // Since authState is now .loading, the guard PASSES, and
        // enterAuthenticated(context: .recoveryKeyError) executes,
        // corrupting the mid-startup state.
        continueOperation.set()
        await acceptTask.value

        // Gap 4: guard only checks != .unauthenticated; .loading passes
        withKnownIssue("Late callback corrupts mid-startup state (Wave 3 fix)") {
            // Late callback from acceptConsent should be a no-op since
            // the session context that initiated it is no longer valid.
            #expect(
                sut.authState == .loading,
                "authState should stay .loading, got \(sut.authState)"
            )
        }
    }
}
