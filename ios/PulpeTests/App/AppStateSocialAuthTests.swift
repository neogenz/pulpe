import Foundation
@testable import Pulpe
import Testing

/// Tests for social auth edge cases:
/// 1. Cross-user biometric contamination (stale key detection)
/// 2. Same-user biometric preservation
/// 3. SocialAuthResult enum correctness
@MainActor
@Suite(.serialized)
struct AppStateSocialAuthTests {
    // MARK: - Cross-User Biometric Contamination

    @Test("Stale biometric key from previous user is rejected and biometric disabled")
    func crossUserBiometric_staleKey_rejected() async {
        let validateCalled = AtomicFlag()

        let sut = AppState(
            keychainManager: MockKeychainStore(lastUsedEmail: "old-apple@privaterelay.appleid.com"),
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            resolveBiometricKey: { "stale-key-from-apple-account" },
            validateBiometricKey: { _ in
                validateCalled.set()
                return false
            }
        )

        sut.biometricEnabled = true
        sut.hasReturningUser = true
        sut.returningUserFlagLoaded = true

        let googleUser = UserInfo(id: "google-user", email: "user@gmail.com", firstName: "Google")
        await sut.resolvePostAuth(user: googleUser)

        #expect(sut.authState == .needsPinEntry)

        let result = await sut.attemptBiometricUnlock()

        #expect(result == false, "Stale key from previous user should be rejected")
        #expect(sut.biometricEnabled == false, "Biometric should be disabled after stale key detection")
        #expect(validateCalled.value == true, "Server validation was attempted with stale key")
    }

    @Test("No biometric key available — unlock returns false without server call")
    func crossUserBiometric_noKey_noServerCall() async {
        let validateCalled = AtomicFlag()

        let sut = AppState(
            keychainManager: MockKeychainStore(lastUsedEmail: "old-apple@privaterelay.appleid.com"),
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            resolveBiometricKey: { nil },
            validateBiometricKey: { _ in
                validateCalled.set()
                return false
            }
        )

        sut.biometricEnabled = true
        sut.hasReturningUser = true
        sut.returningUserFlagLoaded = true

        let googleUser = UserInfo(id: "google-user", email: "user@gmail.com", firstName: "Google")
        await sut.resolvePostAuth(user: googleUser)

        let result = await sut.attemptBiometricUnlock()

        #expect(result == false, "No key available should return false")
        #expect(validateCalled.value == false, "Server should not be called when no key is available")
    }

    // MARK: - SocialAuthResult

    @Test("SocialAuthResult.newUser carries UserInfo")
    func socialAuthResult_newUser_carriesUserInfo() {
        let user = UserInfo(id: "test", email: "test@pulpe.app", firstName: "Test")
        let result = SocialAuthResult.newUser(user)

        if case .newUser(let carried) = result {
            #expect(carried.id == "test")
            #expect(carried.email == "test@pulpe.app")
        } else {
            Issue.record("Expected .newUser, got \(result)")
        }
    }

    @Test("SocialAuthResult.existingUserRedirected has no payload")
    func socialAuthResult_existingUser_noPayload() {
        let result = SocialAuthResult.existingUserRedirected

        if case .existingUserRedirected = result {
            // OK
        } else {
            Issue.record("Expected .existingUserRedirected, got \(result)")
        }
    }
}
