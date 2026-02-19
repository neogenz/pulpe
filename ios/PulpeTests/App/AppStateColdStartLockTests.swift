import Foundation
import Testing
@testable import Pulpe

@MainActor
struct AppStateColdStartLockTests {
    private let testClientKey =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

    @Test func coldStart_authStateIsNotAuthenticated() async {
        // Given: a new AppState (simulating cold start)
        let sut = AppState()

        // When: cold start auth check runs
        await sut.checkAuthState()

        // Then: user must re-authenticate via PIN or biometric — never skipped to .authenticated
        #expect(
            sut.authState != .authenticated,
            "Cold start must block access: authState was \(sut.authState) but must not be .authenticated"
        )
    }

    @Test func coldStart_clearsSessionClientKey() async {
        let clientKeyManager = ClientKeyManager.shared
        await clientKeyManager.clearAll()

        // Simulate: user was previously authenticated with a stored clientKey
        await clientKeyManager.store(testClientKey, enableBiometric: false)
        #expect(await clientKeyManager.resolveClientKey() != nil)

        // Simulate cold start: new AppState instance (app was killed)
        let sut = AppState()
        await sut.checkAuthState()

        // After cold start, the regular keychain clientKey must be cleared
        // so resolvePostAuth can't shortcut to .authenticated without FaceID/PIN
        await clientKeyManager.clearCache()
        let key = await clientKeyManager.resolveClientKey()
        #expect(key == nil, "Regular keychain clientKey should be cleared on cold start")

        await clientKeyManager.clearAll()
    }
}
