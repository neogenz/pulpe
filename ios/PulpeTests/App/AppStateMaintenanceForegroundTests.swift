import Foundation
@testable import Pulpe
import Testing

/// PUL-337: a hot resume past the lock delay must show maintenance instead of the PIN screen,
/// and must keep showing the PIN screen when the maintenance probe itself fails.
@Suite(.serialized)
@MainActor
struct AppStateMaintenanceForegroundTests {
    private let testUser = UserInfo(
        id: "maintenance-user",
        email: "maintenance@pulpe.app",
        firstName: "Maintenance"
    )

    /// Authenticates, backgrounds past the 30s grace period, then resumes.
    private func resumeBeyondGracePeriod(
        maintenanceChecking: @escaping @Sendable () async throws -> Bool
    ) async -> AppState {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false },
            resolveBiometricKey: { nil },
            maintenanceChecking: maintenanceChecking,
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        await sut.handleEnterForeground()
        return sut
    }

    @Test("Resume under maintenance shows maintenance instead of the PIN screen")
    func resume_whenServerInMaintenance_routesToMaintenance() async {
        let sut = await resumeBeyondGracePeriod(maintenanceChecking: { true })

        #expect(sut.isInMaintenance)
        #expect(sut.authState != .needsPinEntry)
        #expect(sut.flowState == .maintenance)
    }

    @Test("A failed maintenance probe still shows the PIN screen")
    func resume_whenProbeFails_routesToPinEntry() async {
        let sut = await resumeBeyondGracePeriod(
            maintenanceChecking: { throw URLError(.timedOut) }
        )

        #expect(sut.isInMaintenance == false)
        #expect(sut.authState == .needsPinEntry)
    }
}
