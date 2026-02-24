import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
struct AppStateStaleClientKeyTests {
    @Test func handleStaleClientKey_whenAuthenticated_transitionsToPinEntry() async {
        let sut = AppState()
        sut.biometricEnabled = false
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        await sut.handleStaleClientKey()

        #expect(sut.authState == .needsPinEntry)
    }

    @Test func handleStaleClientKey_whenNotAuthenticated_doesNotTransition() async {
        let sut = AppState()
        // Default state is .loading
        let initialState = sut.authState

        await sut.handleStaleClientKey()

        #expect(sut.authState == initialState)
    }

    @Test func handleStaleClientKey_clearsClientKeyFully() async {
        let sut = AppState()
        let clientKeyManager = ClientKeyManager.shared

        await clientKeyManager.clearAll()
        await clientKeyManager.store(TestDataFactory.testClientKey, enableBiometric: false)
        #expect(await clientKeyManager.hasClientKey)

        sut.biometricEnabled = false
        await sut.completePinEntry()
        await sut.handleStaleClientKey()

        // clearAll() clears cache + regular keychain + biometric keychain
        // (biometric keychain not testable in simulator — requires hardware)
        #expect(!(await clientKeyManager.hasClientKey))

        await clientKeyManager.clearAll()
    }
}
