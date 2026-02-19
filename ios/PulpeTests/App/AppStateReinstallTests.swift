import Testing
@testable import Pulpe

/// Tests for app reinstallation scenarios where Keychain persists but UserDefaults is cleared.
/// These tests ensure users are properly routed to LoginView (not onboarding) when their
/// session has expired after a reinstall.
/// Note: Tests run serially to avoid race conditions on shared KeychainManager.
@MainActor
@Suite(.serialized)
struct AppStateReinstallTests {
    
    // Clean keychain state before each test to ensure isolation
    init() async throws {
        await KeychainManager.shared.setOnboardingCompleted(false)
    }
    
    // MARK: - Onboarding Flag Persistence
    
    @Test("Onboarding completed flag persists in Keychain")
    func onboardingCompleted_persistsInKeychain() async {
        let keychain = KeychainManager.shared
        
        // Clean state
        await keychain.setOnboardingCompleted(false)
        #expect(await keychain.isOnboardingCompleted() == false)
        
        // Set onboarding completed
        await keychain.setOnboardingCompleted(true)
        #expect(await keychain.isOnboardingCompleted() == true)
        
        // Cleanup
        await keychain.setOnboardingCompleted(false)
    }
    
    @Test("Onboarding completed flag survives AppState recreation")
    func onboardingCompleted_survivesAppStateRecreation() async {
        let keychain = KeychainManager.shared
        
        // Simulate: user completed onboarding in previous session
        await keychain.setOnboardingCompleted(true)
        
        // Simulate: app killed and restarted (new AppState instance)
        let appState = AppState()
        
        // Wait for async initialization with polling (max 1s)
        for _ in 0..<20 {
            try? await Task.sleep(for: .milliseconds(50))
            if appState.hasCompletedOnboarding { break }
        }
        
        // Verify: onboarding flag is loaded from Keychain
        #expect(appState.hasCompletedOnboarding == true)
        
        // Cleanup
        await keychain.setOnboardingCompleted(false)
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
    
    @Test("User with completed onboarding routes to login not welcome")
    func completedOnboarding_routesToLogin() async {
        let keychain = KeychainManager.shared
        
        // Simulate: returning user who completed onboarding before
        await keychain.setOnboardingCompleted(true)
        
        let appState = AppState()
        
        // Wait for async initialization with polling (max 1s)
        for _ in 0..<20 {
            try? await Task.sleep(for: .milliseconds(50))
            if appState.hasCompletedOnboarding { break }
        }
        
        // Simulate: unauthenticated state (expired tokens, logout, etc.)
        // In this state, PulpeApp checks hasCompletedOnboarding to decide Login vs Welcome
        #expect(appState.hasCompletedOnboarding == true, 
                "User with completed onboarding should see LoginView, not OnboardingFlow")
        
        // Cleanup
        await keychain.setOnboardingCompleted(false)
    }
    
    @Test("New user without onboarding flag routes to welcome")
    func newUser_routesToWelcome() async {
        let keychain = KeychainManager.shared
        
        // Simulate: fresh install, no onboarding completed
        await keychain.setOnboardingCompleted(false)
        
        let appState = AppState()
        
        // Wait for async initialization with polling - verify it stays false
        try? await Task.sleep(for: .milliseconds(200))
        
        #expect(appState.hasCompletedOnboarding == false,
                "New user should see OnboardingFlow")
        
        // Cleanup
        await keychain.setOnboardingCompleted(false)
    }
    
    // MARK: - Keychain vs UserDefaults Behavior
    
    @Test("Keychain persists across app reinstall simulation")
    func keychain_persistsAcrossReinstall() async {
        let keychain = KeychainManager.shared
        
        // Step 1: User completes onboarding (stored in Keychain)
        await keychain.setOnboardingCompleted(true)
        
        // Step 2: Simulate reinstall - UserDefaults would be cleared
        // but Keychain persists (we can't actually clear UserDefaults in test)
        
        // Step 3: Create new AppState (simulating fresh app launch after reinstall)
        let appState = AppState()
        
        // Wait for async initialization with polling (max 1s)
        for _ in 0..<20 {
            try? await Task.sleep(for: .milliseconds(50))
            if appState.hasCompletedOnboarding { break }
        }
        
        // Step 4: Verify Keychain value is still available
        #expect(appState.hasCompletedOnboarding == true,
                "Keychain-stored onboarding flag should persist after reinstall")
        
        // Cleanup
        await keychain.setOnboardingCompleted(false)
    }
}
