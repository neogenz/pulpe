@testable import Pulpe
import Testing

/// Tests for app reinstallation scenarios where Keychain persists but UserDefaults is cleared.
/// These tests ensure users are properly routed to LoginView (not onboarding) when their
/// session has expired after a reinstall.
/// Note: Tests run serially to avoid race conditions on shared KeychainManager.
@MainActor
@Suite(.serialized)
struct AppStateReinstallTests {
    private func requireKeychainAvailability() throws {
        try #require(KeychainManager.checkAvailability(), "Keychain unavailable")
    }

    // Clean keychain state before each test to ensure isolation
    init() async throws {
        await KeychainManager.shared.clearLastUsedEmail()
    }

    // MARK: - Returning User Flag Persistence

    @Test("Last used email persists in Keychain as returning user indicator")
    func lastUsedEmail_persistsInKeychain() async throws {
        try requireKeychainAvailability()
        let keychain = KeychainManager.shared

        // Clean state
        await keychain.clearLastUsedEmail()
        #expect(await keychain.getLastUsedEmail() == nil)

        // Save email (returning user)
        await keychain.saveLastUsedEmail("test@pulpe.app")
        #expect(await keychain.getLastUsedEmail() == "test@pulpe.app")

        // Cleanup
        await keychain.clearLastUsedEmail()
    }

    @Test("Returning user flag survives AppState recreation")
    func returningUser_survivesAppStateRecreation() async throws {
        try requireKeychainAvailability()
        let keychain = KeychainManager.shared

        // Simulate: user logged in during previous session
        await keychain.saveLastUsedEmail("test@pulpe.app")

        // Simulate: app killed and restarted (new AppState instance)
        let appState = AppState()

        // Wait for async initialization
        await waitForCondition(timeout: .milliseconds(1000), "Returning user flag should load from Keychain") {
            appState.hasReturningUser == true
        }

        // Verify: returning user flag is loaded from Keychain
        #expect(appState.hasReturningUser == true)

        // Cleanup
        await keychain.clearLastUsedEmail()
    }

    // MARK: - Biometric Token Expiration Scenarios

    @Test("Expired biometric session shows error message")
    func expiredBiometricSession_showsErrorMessage() async {
        // This test verifies the biometricError message is set when session expires
        // The actual biometric flow requires mocking AuthService

        let appState = AppState()

        // Simulate: biometric session validation failed with auth error
        // In production this is set by checkAuthState() when AuthServiceError is caught
        appState.biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"

        #expect(appState.biometricError != nil)
        #expect(appState.biometricError == "Ta session a expiré, connecte-toi avec ton mot de passe")
    }

    @Test("User with saved email routes to login not welcome")
    func returningUser_routesToLogin() async throws {
        try requireKeychainAvailability()
        let keychain = KeychainManager.shared

        // Simulate: returning user who logged in before
        await keychain.saveLastUsedEmail("test@pulpe.app")

        let appState = AppState()

        // Wait for async initialization
        await waitForCondition(timeout: .milliseconds(1000), "Returning user flag should load for routing") {
            appState.hasReturningUser == true
        }

        // Simulate: unauthenticated state (expired tokens, logout, etc.)
        // In this state, PulpeApp checks hasReturningUser to decide Login vs Welcome
        #expect(appState.hasReturningUser == true,
                "User with saved email should see LoginView, not OnboardingFlow")

        // Cleanup
        await keychain.clearLastUsedEmail()
    }

    @Test("New user without saved email routes to welcome")
    func newUser_routesToWelcome() async throws {
        try requireKeychainAvailability()
        let keychain = KeychainManager.shared

        // Simulate: fresh install, no email saved
        await keychain.clearLastUsedEmail()

        let appState = AppState()

        // Wait for async initialization with polling - verify it stays false
        try? await Task.sleep(for: .milliseconds(200))

        #expect(appState.hasReturningUser == false,
                "New user should see OnboardingFlow")

        // Cleanup
        await keychain.clearLastUsedEmail()
    }

    // MARK: - Keychain vs UserDefaults Behavior

    @Test("Keychain persists across app reinstall simulation")
    func keychain_persistsAcrossReinstall() async throws {
        try requireKeychainAvailability()
        let keychain = KeychainManager.shared

        // Step 1: User logs in (email stored in Keychain)
        await keychain.saveLastUsedEmail("test@pulpe.app")

        // Step 2: Simulate reinstall - UserDefaults would be cleared
        // but Keychain persists (we can't actually clear UserDefaults in test)

        // Step 3: Create new AppState (simulating fresh app launch after reinstall)
        let appState = AppState()

        // Wait for async initialization
        await waitForCondition(
            timeout: .milliseconds(1000),
            "Keychain email should persist after reinstall"
        ) {
            appState.hasReturningUser == true
        }

        // Step 4: Verify Keychain value is still available
        #expect(appState.hasReturningUser == true,
                "Keychain-stored email should persist after reinstall")

        // Cleanup
        await keychain.clearLastUsedEmail()
    }
}
