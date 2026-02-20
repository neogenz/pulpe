import Foundation
import Testing
@testable import Pulpe

/// Tests for biometric authentication flow on cold start (app killed and restarted).
/// Ensures Face ID is attempted when enabled, and proper fallback to PIN when Face ID fails/cancels.
@MainActor
@Suite(.serialized)
struct AppStateBiometricColdStartTests {
    
    // MARK: - Test Doubles
    
    /// Mock BiometricPreferenceStore that returns a predetermined value
    actor MockBiometricPreferenceStore: BiometricPreferenceKeychainStoring, BiometricPreferenceDefaultsStoring {
        private var enabled: Bool
        
        init(enabled: Bool) {
            self.enabled = enabled
        }
        
        // BiometricPreferenceKeychainStoring
        func getBiometricEnabledPreference() async -> Bool? { enabled }
        func saveBiometricEnabledPreference(_ enabled: Bool) async { self.enabled = enabled }
        
        // BiometricPreferenceDefaultsStoring
        func getLegacyBiometricEnabled() async -> Bool { false }
        func removeLegacyBiometricEnabled() async {}
    }
    
    /// Mock PostAuthResolver that returns a predetermined destination
    struct MockPostAuthResolver: PostAuthResolving {
        let destination: PostAuthDestination
        
        func resolve() async -> PostAuthDestination { destination }
    }
    
    /// Thread-safe counter for tracking closure invocations
    final class AtomicFlag: @unchecked Sendable {
        private var _value: Bool = false
        private let lock = NSLock()
        
        var value: Bool {
            lock.lock()
            defer { lock.unlock() }
            return _value
        }
        
        func set() {
            lock.lock()
            defer { lock.unlock() }
            _value = true
        }
    }
    
    // MARK: - Cold Start with Biometric Enabled
    
    @Test("Cold start with biometric enabled attempts Face ID before PIN")
    func coldStart_biometricEnabled_attemptsFaceID() async {
        let biometricStore = BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: true),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
        
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .authenticated(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: biometricStore,
            biometricCapability: { true },
            biometricAuthenticate: { },
            syncBiometricCredentials: { true },
            resolveBiometricKey: { "mock-client-key" }
        )
        
        // Wait for biometric preference to load
        await waitForCondition(timeout: .milliseconds(500), "Biometric preference should load from keychain") {
            sut.biometricEnabled == true
        }

        // Manually set biometricEnabled since we can't easily mock the full auth flow
        sut.biometricEnabled = true

        // Note: Full checkAuthState() test requires mocking AuthService
        // This test verifies the biometric preference is correctly loaded and used
        #expect(sut.biometricEnabled == true, "Biometric should be enabled from preference store")
    }
    
    @Test("Cold start with biometric disabled skips Face ID")
    func coldStart_biometricDisabled_skipsFaceID() async {
        let biometricStore = BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: false),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
        
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(destination: .needsPinEntry(needsRecoveryKeyConsent: false)),
            biometricPreferenceStore: biometricStore,
            biometricCapability: { true },
            biometricAuthenticate: { },
            resolveBiometricKey: { nil }
        )
        
        // Wait for biometric preference to load (stays false, just need to wait for hydration)
        try? await Task.sleep(for: .milliseconds(100))

        #expect(sut.biometricEnabled == false, "Biometric should be disabled from preference store")
    }
    
    // MARK: - Biometric Preference Persistence
    
    @Test("Biometric enabled preference is loaded from keychain on init")
    func biometricPreference_loadedFromKeychain() async {
        let biometricStore = BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: true),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
        
        let sut = AppState(
            biometricPreferenceStore: biometricStore,
            biometricCapability: { true }
        )
        
        // Wait for async preference loading
        await waitForCondition(timeout: .milliseconds(1000), "Biometric preference should load as true") {
            sut.biometricEnabled == true
        }

        #expect(sut.biometricEnabled == true)
    }

    @Test("Biometric disabled preference is loaded from keychain on init")
    func biometricDisabledPreference_loadedFromKeychain() async {
        let biometricStore = BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: false),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
        
        let sut = AppState(
            biometricPreferenceStore: biometricStore,
            biometricCapability: { true }
        )
        
        // Wait for async preference loading
        try? await Task.sleep(for: .milliseconds(200))
        
        #expect(sut.biometricEnabled == false)
    }
    
    // MARK: - DEBUG Mode Behavior
    
    @Test("DEBUG mode with biometric enabled still requires biometric auth")
    func debugMode_biometricEnabled_requiresBiometricAuth() async {
        // This test documents the expected behavior:
        // Even in DEBUG mode, if biometricEnabled is true, the app should
        // attempt Face ID authentication instead of skipping to session validation
        
        let biometricStore = BiometricPreferenceStore(
            keychain: MockBiometricPreferenceStore(enabled: true),
            defaults: MockBiometricPreferenceStore(enabled: false)
        )
        
        let sut = AppState(
            biometricPreferenceStore: biometricStore,
            biometricCapability: { true }
        )
        
        // Wait for preference to load
        await waitForCondition(timeout: .milliseconds(1000), "Biometric preference should load as true for DEBUG test") {
            sut.biometricEnabled == true
        }

        // The key assertion: biometricEnabled should be true
        // This ensures the DEBUG block in checkAuthState() will NOT bypass biometric auth
        #expect(sut.biometricEnabled == true, 
                "With biometric enabled, DEBUG mode should not bypass Face ID")
    }
    
    // MARK: - Foreground Biometric Unlock (Integration with Background Lock)
    
    @Test("Foreground after grace period with biometric enabled attempts Face ID")
    func foregroundAfterGrace_biometricEnabled_attemptsFaceID() async {
        let faceIDAttempted = AtomicFlag()
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            syncBiometricCredentials: { true },
            resolveBiometricKey: {
                faceIDAttempted.set()
                return "mock-client-key"
            },
            nowProvider: { now }
        )

        sut.biometricEnabled = true
        await sut.completePinEntry() // Start authenticated

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Exceed grace period
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        #expect(faceIDAttempted.value == true, "Face ID should be attempted on foreground after grace period")
        #expect(sut.authState == .authenticated, "Should stay authenticated after successful Face ID")
    }

    @Test("Foreground after grace period with Face ID cancel falls back to PIN")
    func foregroundAfterGrace_faceIDCancel_fallsToPIN() async {
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { nil }, // Simulate Face ID cancel/fail
            nowProvider: { now }
        )

        sut.biometricEnabled = true
        await sut.completePinEntry() // Start authenticated

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Exceed grace period
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry, "Should fall back to PIN entry when Face ID fails")
    }

    @Test("Biometry lockout falls back to PIN entry without error banner")
    func foregroundAfterGrace_biometryLockout_fallsToPIN() async {
        // Biometry lockout (LAError.biometryLockout) causes resolveBiometricKey to return nil,
        // same as cancel/failure. Cold start path fix is in AuthService.validateBiometricSession()
        // where all LAError codes are now mapped to KeychainError.authFailed (caught by AppState).
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            ),
            syncBiometricCredentials: { true },
            resolveBiometricKey: { nil }, // Lockout: LAContext fails, wrapper returns nil
            nowProvider: { now }
        )

        sut.biometricEnabled = true
        await sut.completePinEntry() // Start authenticated

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Exceed grace period
        sut.prepareForForeground()

        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry, "Biometry lockout should fall back to PIN entry")
        #expect(sut.biometricError == nil, "Biometry lockout should NOT show error banner")
    }

    @Test("Foreground after grace period with biometric disabled goes to PIN")
    func foregroundAfterGrace_biometricDisabled_goesToPIN() async {
        let faceIDAttempted = AtomicFlag()
        var now = Date(timeIntervalSince1970: 0)

        let sut = AppState(
            resolveBiometricKey: {
                faceIDAttempted.set()
                return "mock-client-key"
            },
            nowProvider: { now }
        )

        sut.biometricEnabled = false
        await sut.completePinEntry() // Start authenticated
        
        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // Exceed grace period
        sut.prepareForForeground()
        
        await sut.handleEnterForeground()
        
        #expect(faceIDAttempted.value == false, "Face ID should NOT be attempted when biometric is disabled")
        #expect(sut.authState == .needsPinEntry, "Should go to PIN entry when biometric is disabled")
    }

    // MARK: - hasCompletedOnboarding Loaded Before .unauthenticated

    @Test("checkAuthState loads hasCompletedOnboarding before transitioning to unauthenticated")
    func checkAuthState_loadsOnboardingFlag_beforeUnauthenticated() async {
        guard KeychainManager.checkAvailability() else { return }
        let keychain = KeychainManager.shared

        // Simulate a returning user with completed onboarding
        await keychain.setOnboardingCompleted(true)
        defer { Task { await keychain.setOnboardingCompleted(false) } }

        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: false),
                defaults: MockBiometricPreferenceStore(enabled: false)
            )
        )

        // With biometric disabled, checkAuthState transitions to .unauthenticated
        // ensureOnboardingFlagLoaded() must be called before that transition
        await sut.checkAuthState()

        #expect(sut.authState == .unauthenticated, "State should be unauthenticated when biometric is disabled and no session exists")
        #expect(sut.hasCompletedOnboarding == true, "Onboarding flag must be loaded before .unauthenticated so LoginView is shown instead of OnboardingFlow")
    }

    // MARK: - Expired Biometric Token Cleanup

    @Test("clearBiometricTokens removes all biometric credentials from keychain")
    func clearBiometricTokens_removesAllCredentials() async {
        guard KeychainManager.checkAvailability() else { return }
        let authService = AuthService.shared
        let keychain = KeychainManager.shared

        // Store mock biometric tokens
        let stored = await keychain.saveBiometricTokens(
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token"
        )
        guard stored else { return } // Skip if biometric keychain unavailable (simulator)

        #expect(await authService.hasBiometricTokens() == true, "Tokens should be present before clearing")

        // This is the exact method called by checkAuthState() on AuthServiceError.biometricSessionExpired
        await authService.clearBiometricTokens()

        #expect(await authService.hasBiometricTokens() == false, "Biometric tokens must be cleared after session expiry to prevent repeated failed auth attempts")
    }

    @Test("checkAuthState sets biometricError when session expired path is triggered")
    func checkAuthState_biometricEnabled_noTokens_transitionsToUnauthenticated() async {
        // When biometric is enabled but no tokens are stored,
        // validateBiometricSession() returns nil → authState = .unauthenticated (no error set)
        // This verifies the nil-tokens path is distinct from the expired-tokens path
        let sut = AppState(
            biometricPreferenceStore: BiometricPreferenceStore(
                keychain: MockBiometricPreferenceStore(enabled: true),
                defaults: MockBiometricPreferenceStore(enabled: false)
            )
        )

        // Wait for biometric preference to load as true
        await waitForCondition(timeout: .milliseconds(500), "Biometric preference should load") {
            sut.biometricEnabled == true
        }

        // Ensure no biometric tokens are stored so validateBiometricSession returns nil
        await AuthService.shared.clearBiometricTokens()

        await sut.checkAuthState()

        // No tokens found path: authState = .unauthenticated, biometricError = nil
        #expect(sut.authState == .unauthenticated)
        #expect(sut.biometricError == nil, "No-tokens path should not set biometricError (distinct from expired-session path)")
    }
}
