import Foundation
@testable import Pulpe
import Testing

/// PUL-102 follow-up: After a fresh social login (Apple/Google) when a previous session
/// had biometric enabled, the stale biometric client key in keychain caused FaceID to
/// trigger and succeed at the OS level, but the server rejected the key — leaving the
/// user stuck on the PIN entry screen with no feedback.
///
/// Fix: `prepareSession()` now calls `clientKeyManager.clearAll()` to wipe stale keys
/// before post-auth routing. After PIN entry, `syncAfterAuth()` re-creates the biometric key.
@MainActor
@Suite(.serialized)
struct AppStateFreshLoginBiometricTests {
    private let testUser = UserInfo(id: "apple-user", email: "test@pulpe.app", firstName: "Test")

    // MARK: - Bug Reproduction

    @Test("PUL-102 follow-up: stale biometric key after social login causes silent biometric failure")
    func staleBiometricKey_afterSocialLogin_silentFailure() async {
        let validateCalled = AtomicFlag()

        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            resolveBiometricKey: { "stale-key-from-previous-gmail-session" },
            validateBiometricKey: { _ in
                validateCalled.set()
                return false // Server rejects stale key
            }
        )

        sut.biometricEnabled = true
        sut.hasReturningUser = true
        sut.returningUserFlagLoaded = true

        // User signs in with Apple → vault exists → needsPinEntry
        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .needsPinEntry)

        // PinEntryView auto-triggers biometric → FaceID succeeds → server rejects
        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
        #expect(sut.biometricEnabled == false) // Disabled after stale key detection
        #expect(validateCalled.value == true) // Server WAS called (the bug path)
    }

    // MARK: - Post-Fix Behavior

    @Test("After fresh login with cleared biometric key, unlock returns false without server call")
    func clearedBiometricKey_afterFreshLogin_noServerCall() async {
        let validateCalled = AtomicFlag()

        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            resolveBiometricKey: { nil }, // Key was cleared during prepareSession
            validateBiometricKey: { _ in
                validateCalled.set()
                return false
            }
        )

        sut.biometricEnabled = true
        sut.hasReturningUser = true
        sut.returningUserFlagLoaded = true

        await sut.resolvePostAuth(user: testUser)
        #expect(sut.authState == .needsPinEntry)

        // Biometric unlock with no key available → returns false immediately
        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
        #expect(sut.biometricEnabled == true) // Preference preserved (key re-created after PIN)
        #expect(validateCalled.value == false) // Server NOT called — no key to validate
    }
}
