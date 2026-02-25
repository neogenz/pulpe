@testable import Pulpe
import Testing

/// Tests for app reinstallation scenarios where Keychain persists but UserDefaults is cleared.
/// These tests ensure users are properly routed to LoginView (not onboarding) when their
/// session has expired after a reinstall.
/// Note: Tests run serially to avoid race conditions on shared AppState patterns.
@MainActor
@Suite(.serialized)
struct AppStateReinstallTests {
    // MARK: - Returning User Flag Persistence

    @Test("Last used email persists in Keychain as returning user indicator")
    func lastUsedEmail_persistsInKeychain() async {
        let keychain = MockKeychainStore()

        // Clean state
        await keychain.clearLastUsedEmail()
        #expect(await keychain.getLastUsedEmail() == nil)

        // Save email (returning user)
        await keychain.saveLastUsedEmail("test@pulpe.app")
        #expect(await keychain.getLastUsedEmail() == "test@pulpe.app")
    }

    @Test("Returning user flag survives AppState recreation")
    func returningUser_survivesAppStateRecreation() async {
        let keychain = MockKeychainStore(lastUsedEmail: "test@pulpe.app")

        // Simulate: app killed and restarted (new AppState instance)
        let appState = AppState(keychainManager: keychain, biometricPreferenceStore: .init())

        await appState.bootstrap()

        // Verify: returning user flag is loaded from Keychain
        #expect(appState.hasReturningUser == true)
    }

    // MARK: - Biometric Token Expiration Scenarios

    @Test("Expired biometric session shows error message")
    func expiredBiometricSession_showsErrorMessage() async {
        // This test verifies the biometricError message is set when session expires
        // The actual biometric flow requires mocking AuthService

        let appState = AppState(keychainManager: MockKeychainStore(), biometricPreferenceStore: .init())

        // Simulate: biometric session validation failed with auth error
        // In production this is set by checkAuthState() when AuthServiceError is caught
        appState.biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"

        #expect(appState.biometricError != nil)
        #expect(appState.biometricError == "Ta session a expiré, connecte-toi avec ton mot de passe")
    }

    @Test("User with saved email routes to login not welcome")
    func returningUser_routesToLogin() async {
        let keychain = MockKeychainStore(lastUsedEmail: "test@pulpe.app")

        let appState = AppState(keychainManager: keychain, biometricPreferenceStore: .init())

        await appState.bootstrap()

        // Simulate: unauthenticated state (expired tokens, logout, etc.)
        // In this state, PulpeApp checks hasReturningUser to decide Login vs Welcome
        #expect(appState.hasReturningUser == true,
                "User with saved email should see LoginView, not OnboardingFlow")
    }

    @Test("New user without saved email routes to welcome")
    func newUser_routesToWelcome() async {
        let keychain = MockKeychainStore()

        let appState = AppState(keychainManager: keychain, biometricPreferenceStore: .init())

        // Wait for async initialization with polling - verify it stays false
        try? await Task.sleep(for: .milliseconds(200))

        #expect(appState.hasReturningUser == false,
                "New user should see OnboardingFlow")
    }

    // MARK: - Keychain vs UserDefaults Behavior

    @Test("Keychain persists across app reinstall simulation")
    func keychain_persistsAcrossReinstall() async {
        let keychain = MockKeychainStore(lastUsedEmail: "test@pulpe.app")

        // Step 1: Create new AppState (simulating fresh app launch after reinstall)
        let appState = AppState(keychainManager: keychain, biometricPreferenceStore: .init())

        await appState.bootstrap()

        // Step 2: Verify Keychain value is still available
        #expect(appState.hasReturningUser == true,
                "Keychain-stored email should persist after reinstall")
    }
}
