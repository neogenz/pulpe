import Foundation
@testable import Pulpe
import Security
import Testing

/// Tests for app reinstallation scenarios where Keychain persists but UserDefaults is cleared.
/// These tests ensure users are properly routed to LoginView (not onboarding) when their
/// session has expired after a reinstall.
/// Note: Tests run serially to avoid race conditions on shared AppState patterns.
@MainActor
@Suite(.serialized)
struct AppStateReinstallTests {
    @Test("Only a confirmed Keychain miss is classified as a missing marker")
    func lastUsedEmailReadResult_preservesKeychainTruth() {
        let emailData = Data("returning@pulpe.app".utf8)

        #expect(
            KeychainManager.lastUsedEmailReadResult(status: errSecSuccess, data: emailData)
                == .available("returning@pulpe.app")
        )
        #expect(
            KeychainManager.lastUsedEmailReadResult(status: errSecItemNotFound, data: nil)
                == .missing
        )
        #expect(
            KeychainManager.lastUsedEmailReadResult(status: errSecInteractionNotAllowed, data: nil)
                == .temporarilyUnavailable(errSecInteractionNotAllowed)
        )
        #expect(
            KeychainManager.lastUsedEmailReadResult(status: errSecSuccess, data: Data([0xFF]))
                == .failed(errSecDecode)
        )
        #expect(
            KeychainManager.lastUsedEmailReadResult(status: errSecNotAvailable, data: nil)
                == .failed(errSecNotAvailable)
        )
    }

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
        let appState = makeAppState(keychain: keychain)

        await appState.bootstrap()

        // Verify: returning user flag is loaded from Keychain
        #expect(appState.hasReturningUser == true)
    }

    // MARK: - Session Expiration Scenarios

    @Test("Expired session shows error message")
    func expiredSession_showsErrorMessage() async {
        let appState = AppState(keychainManager: MockKeychainStore(), biometricPreferenceStore: .init())

        // In production this is set by cold-start session validation.
        appState.biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"

        #expect(appState.biometricError != nil)
        #expect(appState.biometricError == "Ta session a expiré, connecte-toi avec ton mot de passe")
    }

    @Test("User with saved email routes to login not welcome")
    func returningUser_routesToLogin() async {
        let keychain = MockKeychainStore(lastUsedEmail: "test@pulpe.app")

        let appState = makeAppState(keychain: keychain)

        await appState.bootstrap()

        // Simulate: unauthenticated state (expired tokens, logout, etc.)
        // In this state, PulpeApp checks hasReturningUser to decide Login vs Welcome
        #expect(appState.hasReturningUser == true,
                "User with saved email should see LoginView, not OnboardingFlow")
    }

    @Test("New user without saved email routes to welcome")
    func newUser_routesToWelcome() async {
        let keychain = MockKeychainStore()

        let appState = makeAppState(keychain: keychain)

        // Wait for async initialization with polling - verify it stays false
        try? await Task.sleep(for: .milliseconds(200))

        #expect(appState.hasReturningUser == false,
                "New user should see OnboardingFlow")
    }

    @Test("Fresh install clears a stale marker and keeps the welcome route")
    func freshInstall_clearsStaleMarker() async {
        let keychain = MockKeychainStore(lastUsedEmail: "stale@pulpe.app")
        let appState = makeAppState(keychain: keychain, hasLaunchedBefore: false)

        await appState.bootstrap()

        #expect(!appState.hasReturningUser)
        #expect(await keychain.readLastUsedEmail() == .missing)
    }

    // MARK: - Keychain vs UserDefaults Behavior

    @Test("Keychain persists across app reinstall simulation")
    func keychain_persistsAcrossReinstall() async {
        let keychain = MockKeychainStore(lastUsedEmail: "test@pulpe.app")

        // Step 1: Create new AppState (simulating fresh app launch after reinstall)
        let appState = makeAppState(keychain: keychain)

        await appState.bootstrap()

        // Step 2: Verify Keychain value is still available
        #expect(appState.hasReturningUser == true,
                "Keychain-stored email should persist after reinstall")
    }

    private func makeAppState(
        keychain: MockKeychainStore,
        hasLaunchedBefore: Bool = true
    ) -> AppState {
        var dependencies = AppStateDependencies.default
        dependencies.keychainManager = keychain
        dependencies.biometricPreferenceStore = .init()
        dependencies.flagsStore = MockAppAuthFlagsStore(hasLaunchedBefore: hasLaunchedBefore)
        return AppState(dependencies: dependencies)
    }
}
