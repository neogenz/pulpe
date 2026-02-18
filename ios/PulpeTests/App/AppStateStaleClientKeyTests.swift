import Foundation
import Testing
@testable import Pulpe

@MainActor
struct AppStateStaleClientKeyTests {
    private let testClientKey =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    @Test func handleStaleClientKey_whenAuthenticated_transitionsToPinEntry() async {
        let sut = AppState()
        sut.biometricEnabled = false
        sut.completePinEntry()
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

    @Test func handleStaleClientKey_clearsClientKeySession() async {
        let sut = AppState()
        let clientKeyManager = ClientKeyManager.shared

        await clientKeyManager.clearAll()
        await clientKeyManager.store(testClientKey, enableBiometric: false)
        #expect(await clientKeyManager.hasClientKey)

        sut.biometricEnabled = false
        sut.completePinEntry()
        await sut.handleStaleClientKey()

        #expect(!(await clientKeyManager.hasClientKey))

        await clientKeyManager.clearAll()
    }
}
