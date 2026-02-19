import Foundation
import Testing
@testable import Pulpe

@MainActor
struct AppStateBackgroundLockTests {
    private let testClientKey =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    @Test func foregroundBeforeGracePeriod_keepsAuthenticated() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 29) // Just under 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
    }

    @Test func foregroundAtGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 30) // Exactly 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func foregroundAfterGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

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
        let sut = AppState(nowProvider: { now })
        let clientKeyManager = ClientKeyManager.shared

        await clientKeyManager.clearAll()
        await clientKeyManager.store(testClientKey, enableBiometric: false)
        #expect(await clientKeyManager.hasClientKey)

        sut.biometricEnabled = false
        sut.completePinEntry()
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
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

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
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

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
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

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
}
