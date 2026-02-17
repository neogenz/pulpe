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
        now = Date(timeIntervalSince1970: 299)
        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
    }

    @Test func foregroundAtGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 300)
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func foregroundAfterGracePeriod_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        sut.biometricEnabled = false
        sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 301)
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func foregroundAfterGracePeriodWhenNotAuthenticated_keepsState() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = AppState(nowProvider: { now })
        let initialState = sut.authState

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 400)
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
        now = Date(timeIntervalSince1970: 301)
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
        #expect(!(await clientKeyManager.hasClientKey))

        await clientKeyManager.clearAll()
    }
}
