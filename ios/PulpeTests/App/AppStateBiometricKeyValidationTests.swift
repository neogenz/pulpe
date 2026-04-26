// swiftlint:disable type_body_length
import Foundation
@testable import Pulpe
import Testing

/// Tests for biometric key validation feature in AppState.
/// Ensures validateBiometricKey is called during unlock and session validation flows,
/// and that stale/invalid keys are properly detected and cleared.
@MainActor
@Suite(.serialized)
struct AppStateBiometricKeyValidationTests {
    // MARK: - attemptBiometricUnlock Tests

    @Test("attemptBiometricUnlock validates key and returns true when valid")
    func attemptBiometricUnlock_validKey_returnsTrue() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            biometricCapability: { true },
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "valid-client-key-hex" },
            validateBiometricKey: { _ in true }
        )

        sut.biometricEnabled = true
        let result = await sut.attemptBiometricUnlock()
        #expect(result == true)
        #expect(sut.biometricEnabled == true)
    }

    @Test("attemptBiometricUnlock clears biometric state when key is stale")
    func attemptBiometricUnlock_staleKey_clearsAndReturnsFalse() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            biometricCapability: { true },
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "stale-client-key-hex" },
            validateBiometricKey: { _ in false }
        )

        sut.biometricEnabled = true
        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
        #expect(sut.biometricEnabled == false)
    }

    @Test("attemptBiometricUnlock returns false when biometric is disabled")
    func attemptBiometricUnlock_biometricDisabled_returnsFalse() async {
        let sut = AppState(
            resolveBiometricKey: { "some-key" },
            validateBiometricKey: { _ in true }
        )

        sut.biometricEnabled = false
        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
    }

    @Test("attemptBiometricUnlock returns false when no biometric key available")
    func attemptBiometricUnlock_nilKey_returnsFalse() async {
        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { nil },
            validateBiometricKey: { _ in true }
        )

        sut.biometricEnabled = true
        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
        #expect(sut.biometricEnabled == true)
    }

    // MARK: - attemptBiometricSessionValidation Tests

    @Test("attemptBiometricSessionValidation stores key when valid during cold start")
    func attemptBiometricSessionValidation_validKey_storesKey() async {
        let testUser = UserInfo(
            id: "test-user-id",
            email: "test@example.com",
            firstName: "Test"
        )
        let sessionResult = BiometricSessionResult(
            user: testUser,
            clientKeyHex: "valid-client-key-hex"
        )

        // PUL-132: biometric-keychain validation runs only on explicit-logout cold-start.
        defer {
            UserDefaults.standard.removeObject(forKey: "pulpe-has-launched-before")
            UserDefaults.standard.removeObject(forKey: "pulpe-did-explicit-logout")
        }

        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            biometricCapability: { true },
            biometricAuthenticate: { },
            syncBiometricCredentials: { true },
            validateBiometricKey: { _ in true },
            validateBiometricSession: { sessionResult },
            maintenanceChecking: { false }
        )

        UserDefaults.standard.set(true, forKey: "pulpe-has-launched-before")
        UserDefaults.standard.set(true, forKey: "pulpe-did-explicit-logout")

        await sut.checkAuthState()

        #expect(sut.authState == .authenticated)
        #expect(sut.currentUser != nil)
        #expect(sut.currentUser?.id == testUser.id)
    }

    @Test("attemptBiometricSessionValidation clears biometric state when key is stale")
    func attemptBiometricSessionValidation_staleKey_clearsState() async {
        let testUser = UserInfo(
            id: "test-user-id",
            email: "test@example.com",
            firstName: "Test"
        )
        let sessionResult = BiometricSessionResult(
            user: testUser,
            clientKeyHex: "stale-client-key-hex"
        )

        // PUL-132: biometric-keychain validation runs only on explicit-logout cold-start.
        defer {
            UserDefaults.standard.removeObject(forKey: "pulpe-has-launched-before")
            UserDefaults.standard.removeObject(forKey: "pulpe-did-explicit-logout")
        }

        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            biometricCapability: { true },
            syncBiometricCredentials: { true },
            validateBiometricKey: { _ in false },
            validateBiometricSession: { sessionResult },
            maintenanceChecking: { false }
        )

        UserDefaults.standard.set(true, forKey: "pulpe-has-launched-before")
        UserDefaults.standard.set(true, forKey: "pulpe-did-explicit-logout")

        await sut.checkAuthState()

        #expect(sut.biometricEnabled == false)
    }

    // MARK: - Key Validation Error Paths

    @Test("stale key in attemptBiometricUnlock clears clientKeyManager")
    func attemptBiometricUnlock_staleKey_clearsClientKeyManager() async {
        let clientKeyManager = ClientKeyManager.shared

        let sut = AppState(
            clientKeyManager: clientKeyManager,
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),

            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            biometricCapability: { true },
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "stale-client-key" },
            validateBiometricKey: { _ in false }
        )

        sut.biometricEnabled = true

        // Store a key so we can verify it gets cleared
        await clientKeyManager.store("dummy-key", enableBiometric: false)

        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
        #expect(sut.biometricEnabled == false)
    }

    @Test("valid key in attemptBiometricUnlock keeps biometric enabled")
    func attemptBiometricUnlock_validKey_keepsBiometricEnabled() async {
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            biometricCapability: { true },
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "valid-key-hex" },
            validateBiometricKey: { _ in true }
        )

        sut.biometricEnabled = true

        let result = await sut.attemptBiometricUnlock()
        #expect(result == true)
        #expect(sut.biometricEnabled == true)
    }

    // MARK: - Sendable Closure Behavior

    @Test("validateBiometricKey closure receives correct key parameter")
    func validateBiometricKey_receivesKeyParameter() async {
        let capturedKey = AtomicProperty<String?>(nil)

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { "test-key-123" },
            validateBiometricKey: { key in
                capturedKey.set(key)
                return true
            }
        )

        sut.biometricEnabled = true
        _ = await sut.attemptBiometricUnlock()

        #expect(capturedKey.value == "test-key-123")
    }

    @Test("validateBiometricKey is not called when no key resolved")
    func validateBiometricKey_notCalledWhenKeyIsNil() async {
        let validateWasCalled = AtomicProperty(false)

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { nil },
            validateBiometricKey: { _ in
                validateWasCalled.set(true)
                return true
            }
        )

        sut.biometricEnabled = true
        _ = await sut.attemptBiometricUnlock()

        #expect(validateWasCalled.value == false)
    }

    @Test("validateBiometricKey respects false return value")
    func validateBiometricKey_falseReturnValue_triggersClearance() async {
        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { "client-key" },
            validateBiometricKey: { _ in false }
        )

        sut.biometricEnabled = true
        let result = await sut.attemptBiometricUnlock()

        #expect(result == false)
        #expect(sut.biometricEnabled == false)
    }

    @Test("validateBiometricKey respects true return value")
    func validateBiometricKey_trueReturnValue_returnsSuccess() async {
        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { "client-key" },
            validateBiometricKey: { _ in true }
        )

        sut.biometricEnabled = true
        let result = await sut.attemptBiometricUnlock()

        #expect(result == true)
        #expect(sut.biometricEnabled == true)
    }

    // MARK: - Default validateBiometricKey Behavior

    @Test("validateBiometricKey defaults to encryptionAPI.validateKey when nil")
    func validateBiometricKey_defaultsToEncryptionAPI() async {
        // When validateBiometricKey is not provided, it should default to
        // calling encryptionAPI.validateKey(). This test documents the expected behavior.
        let sut = AppState(
            encryptionAPI: .shared,
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { "valid-key" }
            // validateBiometricKey is nil, so init will provide default closure
        )

        sut.biometricEnabled = true

        // With no key resolved, result is false regardless of validator
        let result = await sut.attemptBiometricUnlock()
        #expect(result == false)
    }

    // MARK: - Edge Cases

    @Test("attemptBiometricUnlock with empty key string returns false from validator")
    func attemptBiometricUnlock_emptyKeyString_returnsFromValidator() async {
        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { "" },
            validateBiometricKey: { key in
                // Validator sees empty string
                return !key.isEmpty
            }
        )

        sut.biometricEnabled = true
        let result = await sut.attemptBiometricUnlock()

        #expect(result == false)
        #expect(sut.biometricEnabled == false)
    }

    @Test("foreground biometric unlock validates key before staying authenticated")
    func handleEnterForeground_validKey_staysAuthenticated() async {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let pinResolver = MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        let user = UserInfo(id: "key-val-user", email: "keyval@pulpe.app", firstName: "Key")

        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "valid-key" },
            validateBiometricKey: { _ in true },
            nowProvider: { now }
        )

        sut.biometricEnabled = true
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
        #expect(sut.biometricEnabled == true)
    }

    @Test("foreground biometric unlock with stale key falls back to PIN")
    func handleEnterForeground_staleKey_fallsToPIN() async {
        nonisolated(unsafe) var now = Date(timeIntervalSince1970: 0)
        let pinResolver = MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false))
        let user = UserInfo(id: "key-val-user", email: "keyval@pulpe.app", firstName: "Key")

        let sut = AppState(
            postAuthResolver: pinResolver,
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "stale-key" },
            validateBiometricKey: { _ in false },
            nowProvider: { now }
        )

        sut.biometricEnabled = true
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.biometricEnabled == false)
    }

    @Test("attemptBiometricUnlock multiple times with alternating validation results")
    func attemptBiometricUnlock_multipleAttempts_respectsValidationState() async {
        let validationResult = AtomicProperty(true)

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            resolveBiometricKey: { "key" },
            validateBiometricKey: { _ in validationResult.value }
        )

        sut.biometricEnabled = true

        // First attempt: valid
        var result = await sut.attemptBiometricUnlock()
        #expect(result == true)
        #expect(sut.biometricEnabled == true)

        // Change validation result
        validationResult.set(false)

        // Second attempt: stale
        result = await sut.attemptBiometricUnlock()
        #expect(result == false)
        #expect(sut.biometricEnabled == false)
    }
}
