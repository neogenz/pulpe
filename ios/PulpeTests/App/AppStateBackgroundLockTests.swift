import Foundation
@testable import Pulpe
import Testing

// swiftlint:disable type_body_length
@Suite(.serialized)
@MainActor
struct AppStateBackgroundLockTests {
    private let pinResolver = MockPostAuthResolver(
        destination: .needsPinEntry(needsRecoveryKeyConsent: false)
    )
    private let testUser = UserInfo(id: "lock-user", email: "lock@pulpe.app", firstName: "Lock")

    /// Transition SUT through the state machine to `.authenticated` via PIN entry.
    private func authenticateViaPinEntry(_ sut: AppState) async {
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
    }

    @Test func foregroundBeforeGracePeriod_keepsAuthenticated() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 29) // Just under 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
    }

    @Test func foregroundAtGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 30) // Exactly 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func foregroundAfterGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Just over 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func foregroundAfterGracePeriodWhenNotAuthenticated_keepsState() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        let initialState = sut.authState

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 60) // Well over 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == initialState)
    }

    @Test func foregroundAfterGracePeriod_clearsInMemoryClientKeyCache() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        let clientKeyManager = ClientKeyManager.shared

        await clientKeyManager.clearAll()
        await clientKeyManager.store(TestDataFactory.testClientKey, enableBiometric: false)
        #expect(await clientKeyManager.hasClientKey)

        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Just over 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
        #expect(!(await clientKeyManager.hasClientKey))

        await clientKeyManager.clearAll()
    }

    // MARK: - Rapid Transitions

    @Test func rapidForegroundBackgroundTransitions_maintainsConsistentState() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        // Simulate rapid app switching (user multitasking quickly)
        // Each cycle: background -> foreground within grace period
        for cycle in 1...10 {
            sut.handleEnterBackground()
            now = now.addingTimeInterval(5) // 5s between each transition (within 30s grace)
            await sut.handleEnterForeground()

            #expect(
                sut.authState == .authenticated,
                "Cycle \(cycle): Expected .authenticated but got \(sut.authState)"
            )
        }
    }

    @Test func rapidTransitions_thenExceedGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        // Several quick transitions within grace period
        for _ in 1...3 {
            sut.handleEnterBackground()
            now = now.addingTimeInterval(5)
            await sut.handleEnterForeground()
        }
        #expect(sut.authState == .authenticated)

        // Final background -> exceed grace period -> foreground
        sut.handleEnterBackground()
        now = now.addingTimeInterval(35) // Exceeds 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func backgroundWithoutForeground_thenForegroundAfterGrace_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        // Multiple background calls without foreground (edge case - shouldn't happen normally)
        // Implementation uses the LAST background timestamp (resets the timer on each background event)
        sut.handleEnterBackground()
        now = now.addingTimeInterval(10)
        sut.handleEnterBackground() // Second background call resets timer
        now = now.addingTimeInterval(25) // Only 25s from LAST background (within grace period)

        await sut.handleEnterForeground()

        // Since 25s < 30s grace period from last background call, user stays authenticated
        #expect(sut.authState == .authenticated)
    }

    // MARK: - Session Restoration Flag

    @Test func prepareForForeground_gracePeriodExpired_setsRestoringSession() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()

        #expect(sut.isRestoringSession == true)
    }

    @Test func prepareForForeground_withinGracePeriod_doesNotSetRestoringSession() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 10)
        sut.prepareForForeground()

        #expect(sut.isRestoringSession == false)
    }

    @Test func handleEnterForeground_clearsRestoringSession_whenLockNoLongerRequired() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        // Grace period expired → isRestoringSession = true
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        #expect(sut.isRestoringSession == true)

        // Reset timer — lock no longer required
        sut.handleEnterBackground()

        // Early return path, but defer still clears the flag
        await sut.handleEnterForeground()

        #expect(sut.isRestoringSession == false)
        #expect(sut.authState == .authenticated)
    }

    // MARK: - Biometric Foreground Unlock

    @Test func foregroundAfterGracePeriod_biometricSucceeds_staysAuthenticated() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "restored-key" },
            validateBiometricKey: { _ in true },
            nowProvider: { now }
        )
        sut.biometricEnabled = true
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        #expect(sut.isRestoringSession == true)

        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
        #expect(sut.isRestoringSession == false)
    }

    @Test func foregroundAfterGracePeriod_biometricFails_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { nil },
            nowProvider: { now }
        )
        sut.biometricEnabled = true
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        #expect(sut.isRestoringSession == true)

        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.isRestoringSession == false)
    }

    // MARK: - Session Refresh After Biometric Foreground Unlock (C2-2)

    @Test func foregroundBiometricUnlock_refreshesSupabaseSession() async {
        let sessionRefreshed = AtomicFlag()
        var now = Date(timeIntervalSince1970: 0)
        let user = UserInfo(id: "u1", email: "test@pulpe.app", firstName: "Max")

        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "restored-key" },
            validateBiometricKey: { _ in true },
            validateRegularSession: {
                sessionRefreshed.set()
                return user
            },
            nowProvider: { now }
        )
        sut.biometricEnabled = true
        await authenticateViaPinEntry(sut)

        // Simulate long background (token would be expired)
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 3600) // 1 hour
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
        // Session must be refreshed after biometric unlock to prevent 401 cascades
        await waitForCondition(
            timeout: .milliseconds(500),
            "validateRegularSession must be called after biometric foreground unlock"
        ) {
            sessionRefreshed.value
        }
    }

    @Test func foregroundBiometricUnlock_sessionRefreshFailure_logsOut() async {
        let sessionRefreshAttempted = AtomicFlag()
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "restored-key" },
            validateBiometricKey: { _ in true },
            validateRegularSession: {
                sessionRefreshAttempted.set()
                throw URLError(.userAuthenticationRequired)
            },
            nowProvider: { now }
        )
        sut.biometricEnabled = true
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 7200) // 2 hours
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        // Session refresh was attempted
        await waitForCondition(
            timeout: .milliseconds(500),
            "validateRegularSession must be attempted"
        ) {
            sessionRefreshAttempted.value
        }
        // When session refresh fails, user should be logged out
        await waitForCondition(
            timeout: .milliseconds(500),
            "authState should be unauthenticated after session refresh failure"
        ) {
            sut.authState == .unauthenticated
        }
    }

    @Test func foregroundBiometricUnlock_sessionRefreshReturnsNil_logsOut() async {
        let sessionRefreshAttempted = AtomicFlag()
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "restored-key" },
            validateBiometricKey: { _ in true },
            validateRegularSession: {
                sessionRefreshAttempted.set()
                return nil // No active session - should trigger logout
            },
            nowProvider: { now }
        )
        sut.biometricEnabled = true
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 7200) // 2 hours
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        // Session refresh was attempted
        await waitForCondition(
            timeout: .milliseconds(500),
            "validateRegularSession must be attempted"
        ) {
            sessionRefreshAttempted.value
        }
        // When session refresh returns nil (no session), user should be logged out
        await waitForCondition(
            timeout: .milliseconds(500),
            "authState should be unauthenticated when session refresh returns nil"
        ) {
            sut.authState == .unauthenticated
        }
    }

    @Test func foregroundAfterGracePeriod_biometricDisabled_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(postAuthResolver: pinResolver, nowProvider: { now })
        sut.biometricEnabled = false
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        #expect(sut.isRestoringSession == true)

        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.isRestoringSession == false)
    }

    // MARK: - Race Condition: Logout During Foreground Refresh

    @Test func foregroundRefresh_logoutDuringRefresh_endsUnauthenticated() async {
        let refreshStarted = AtomicFlag()
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "restored-key" },
            validateBiometricKey: { _ in true },
            validateRegularSession: {
                refreshStarted.set()
                try await Task.sleep(for: .milliseconds(200))
                throw URLError(.userAuthenticationRequired)
            },
            nowProvider: { now }
        )
        sut.biometricEnabled = true
        await authenticateViaPinEntry(sut)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()

        // This triggers biometric unlock + fire-and-forget background refresh
        await sut.handleEnterForeground()

        // Wait for background refresh to actually start
        await waitForCondition(timeout: .milliseconds(500), "refresh must start") {
            refreshStarted.value
        }

        // User logs out while background refresh is in-flight
        await sut.logout(source: .userInitiated)

        // Wait for background task to settle
        await waitForCondition(timeout: .milliseconds(500), "background task settled") {
            sut.authState == .unauthenticated
        }

        #expect(sut.authState == .unauthenticated)

        // The explicit logout flag must survive — if the background task's system logout
        // clears it, FaceID would auto-trigger on next cold start instead of showing login.
        let didExplicitLogout = UserDefaults.standard.bool(forKey: "pulpe-did-explicit-logout")
        #expect(didExplicitLogout == true, "Background task must not clear explicit logout flag")

        // Cleanup
        UserDefaults.standard.removeObject(forKey: "pulpe-did-explicit-logout")
    }
}
