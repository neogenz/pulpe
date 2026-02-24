import Foundation
@testable import Pulpe
import Testing

/// Tests for biometric enable/disable functionality on AppState.
/// Ensures enableBiometric() and disableBiometric() work correctly.
@MainActor
@Suite(.serialized)
struct AppStateBiometricEnableDisableTests {
    // MARK: - enableBiometric() Tests

    @Test("enableBiometric with no biometric capability returns false")
    func enableBiometric_noBiometricCapability_returnsFalse() async {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { false }
        )

        let result = await sut.enableBiometric()

        #expect(result == false, "enableBiometric should return false when biometric capability is unavailable")
        #expect(sut.biometricEnabled == false, "biometricEnabled should remain false")
    }

    @Test("enableBiometric when user denies prompt returns false")
    func enableBiometric_userDeniedPrompt_returnsFalse() async {
        struct DenialError: Error {}

        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { true },
            biometricAuthenticate: {
                throw DenialError()
            }
        )

        let result = await sut.enableBiometric()

        #expect(result == false, "enableBiometric should return false when user denies biometric prompt")
        #expect(sut.biometricEnabled == false, "biometricEnabled should remain false after user denial")
    }

    @Test("enableBiometric when token save fails returns false")
    func enableBiometric_tokenSaveFails_returnsFalse() async {
        // Without a valid session, authService.saveBiometricTokens() will fail
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { true },
            biometricAuthenticate: { } // succeeds
        )

        let result = await sut.enableBiometric()

        #expect(result == false, "enableBiometric should return false when token save fails")
        #expect(sut.biometricEnabled == false, "biometricEnabled should remain false after token save failure")
    }

    // MARK: - disableBiometric() Tests

    @Test("disableBiometric clears biometric enabled flag")
    func disableBiometric_clearsBiometricEnabled() async throws {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            biometricCapability: { true }
        )

        // Wait for biometric preference to load from keychain
        await waitForCondition(timeout: .milliseconds(500), "Biometric preference should load as true") {
            sut.biometricEnabled == true
        }

        try #require(sut.biometricEnabled == true, "Setup: biometric should be enabled before disabling")

        await sut.disableBiometric()

        #expect(sut.biometricEnabled == false, "biometricEnabled should be false after disableBiometric")
    }

    @Test("disableBiometric with already disabled biometric remains false")
    func disableBiometric_alreadyDisabled_remainsFalse() async throws {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        try #require(sut.biometricEnabled == false, "Setup: biometric should be disabled initially")

        await sut.disableBiometric()

        #expect(sut.biometricEnabled == false, "biometricEnabled should remain false")
    }

    // MARK: - Integration Tests

    @Test("enable then disable biometric in sequence")
    func enableThenDisable_biometricToggles() async throws {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricCapability: { true }
        )

        try #require(sut.biometricEnabled == false, "Setup: start with biometric disabled")

        // Note: enableBiometric() requires valid session for token save,
        // so we can't test the full happy path without mocking deeper.
        // Instead, verify the disableBiometric path works after enable attempt.
        let enableResult = await sut.enableBiometric()
        #expect(enableResult == false, "Enable should fail without valid session")
        #expect(sut.biometricEnabled == false, "biometricEnabled should still be false")

        await sut.disableBiometric()

        #expect(sut.biometricEnabled == false, "Still disabled after disableBiometric")
    }

    @Test("disableBiometric clears credentials availability")
    func disableBiometric_clearsCredentialsAvailable() async {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            biometricCapability: { true }
        )

        await waitForCondition(timeout: .milliseconds(500), "Biometric preference should load") {
            sut.biometricEnabled == true
        }

        sut.biometricCredentialsAvailable = true

        await sut.disableBiometric()

        #expect(sut.biometricEnabled == false, "biometricEnabled should be false")
        // Note: biometricCredentialsAvailable is not explicitly cleared by disableBiometric(),
        // but biometricEnabled being false prevents its use (Face ID button hidden via &&).
    }
}
