import Foundation
@testable import Pulpe
import Testing

/// PUL-337: a hot resume past the lock delay must show maintenance instead of unlocking —
/// no Face ID prompt, no PIN screen — while a failed or cancelled probe changes nothing.
@Suite(.serialized)
@MainActor
struct AppStateMaintenanceForegroundTests {
    private let testUser = UserInfo(
        id: "maintenance-user",
        email: "maintenance@pulpe.app",
        firstName: "Maintenance"
    )

    /// Authenticates, then backgrounds past the 30s grace period so the next foreground
    /// entry needs an unlock.
    private func makeLockedSUT(
        biometricEnabled: Bool = false,
        resolveBiometricKey: (@Sendable () async -> String?)? = nil,
        maintenanceChecking: @escaping @Sendable () async throws -> Bool
    ) async -> AppState {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: biometricEnabled
                ? AppStateTestFactory.biometricEnabledStore()
                : AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { biometricEnabled },
            resolveBiometricKey: resolveBiometricKey ?? { nil },
            validateBiometricKey: { _ in true },
            maintenanceChecking: maintenanceChecking,
            nowProvider: { now }
        )
        sut.biometricEnabled = biometricEnabled
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        return sut
    }

    @Test("Resume under maintenance shows maintenance instead of the PIN screen")
    func resume_whenServerInMaintenance_routesToMaintenance() async {
        let sut = await makeLockedSUT(maintenanceChecking: { true })

        await sut.handleEnterForeground()

        #expect(sut.isInMaintenance)
        #expect(sut.authState != .needsPinEntry)
        #expect(sut.flowState == .maintenance)
    }

    /// The maintenance resume returns before `handleEnterForeground`, the only other consumer
    /// of the background timestamp. A leftover date re-locks on the next `.inactive` →
    /// `.active` bounce, which never calls `handleEnterBackground` and so never refreshes it.
    @Test("Resume under maintenance consumes the background timestamp")
    func resume_whenServerInMaintenance_consumesBackgroundDate() async {
        let sut = await makeLockedSUT(maintenanceChecking: { true })

        await sut.handleEnterForeground()
        let locksAgain = sut.sessionLifecycleCoordinator.backgroundLockApplies(
            authState: .authenticated
        )

        #expect(locksAgain == false, "A stale background date would re-lock an unlocked user")
    }

    @Test("Resume under maintenance never prompts Face ID")
    func resume_whenServerInMaintenance_skipsBiometricUnlock() async {
        nonisolated(unsafe) var resolveCalls = 0
        let sut = await makeLockedSUT(
            biometricEnabled: true,
            resolveBiometricKey: { resolveCalls += 1; return "biometric-key" },
            maintenanceChecking: { true }
        )

        await sut.handleEnterForeground()

        #expect(resolveCalls == 0, "Under maintenance the unlock never runs, so Face ID never prompts")
        #expect(sut.isInMaintenance)
        #expect(sut.flowState == .maintenance)
        #expect(sut.authState != .needsPinEntry)
    }

    @Test("A failed maintenance probe still shows the PIN screen")
    func resume_whenProbeFails_routesToPinEntry() async {
        let sut = await makeLockedSUT(
            maintenanceChecking: { throw URLError(.timedOut) }
        )

        await sut.handleEnterForeground()

        #expect(sut.isInMaintenance == false)
        #expect(sut.authState == .needsPinEntry)
    }

    /// A background/foreground bounce cancels the in-flight run (AppRuntimeCoordinator) and
    /// starts another; the abandoned run must not force a PIN prompt behind the live one.
    @Test("A run cancelled during the probe writes no state")
    func resume_whenCancelledDuringProbe_writesNoState() async {
        let sut = await makeLockedSUT(maintenanceChecking: {
            try await Task.sleep(for: .seconds(1))
            return true
        })

        let run = Task { await sut.handleEnterForeground() }
        await Task.yield()
        run.cancel()
        await run.value

        #expect(sut.authState == .authenticated, "The abandoned run must not force PIN entry")
        #expect(sut.isInMaintenance == false)
    }
}
