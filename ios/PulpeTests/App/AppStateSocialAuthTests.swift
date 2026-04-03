import Foundation
@testable import Pulpe
import Testing

/// Tests for cross-user biometric contamination:
/// When user A (biometric enabled) logs out and user B logs in,
/// the stale biometric key from user A must not grant access to user B's vault.
///
/// Two defense layers:
/// 1. `prepareSession` proactively disables biometric on user switch (not testable via public API)
/// 2. `attemptBiometricUnlock` reactively detects stale key and disables biometric (tested here)
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

    // MARK: - ExistingUserRedirectedError

    @Test("ExistingUserRedirectedError is a distinct error type")
    func existingUserError_isDistinct() {
        let error: Error = ExistingUserRedirectedError()

        #expect(error is ExistingUserRedirectedError)
        #expect(!(error is CancellationError))
    }
}
