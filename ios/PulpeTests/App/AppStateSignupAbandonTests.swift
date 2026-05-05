import Foundation
@testable import Pulpe
import Testing

/// Tests for the mid-onboarding signup abandon flow and provider-aware routing.
///
/// Covers three bug fixes:
/// 1. `AuthProvider.fromSupabase` parses Supabase app_metadata.provider values
/// 2. `applyPostAuthDestination` routes email users via `.email` pendingOnboardingUser,
///    social users via `.social` pendingOnboardingUser
/// 3. `abandonInProgressSignup()` clears all onboarding + session state slots
@MainActor
@Suite(.serialized)
struct AppStateSignupAbandonTests {
    // MARK: - AuthProvider.fromSupabase parsing

    @Test("email maps to .email")
    func authProvider_email() {
        #expect(AuthProvider.fromSupabase("email") == .email)
        #expect(AuthProvider.fromSupabase("EMAIL") == .email)
    }

    @Test("apple and apple.com both map to .apple")
    func authProvider_apple() {
        #expect(AuthProvider.fromSupabase("apple") == .apple)
        #expect(AuthProvider.fromSupabase("apple.com") == .apple)
        #expect(AuthProvider.fromSupabase("Apple") == .apple)
    }

    @Test("google and google.com both map to .google")
    func authProvider_google() {
        #expect(AuthProvider.fromSupabase("google") == .google)
        #expect(AuthProvider.fromSupabase("google.com") == .google)
        #expect(AuthProvider.fromSupabase("GOOGLE") == .google)
    }

    @Test("unknown providers return nil")
    func authProvider_unknown() {
        #expect(AuthProvider.fromSupabase("facebook") == nil)
        #expect(AuthProvider.fromSupabase("") == nil)
    }

    // MARK: - UserInfo construction

    @Test("UserInfo defaults provider to nil for legacy call sites")
    func userInfo_defaultProviderIsNil() {
        let user = UserInfo(id: "1", email: "test@test.com", firstName: "Marie")
        #expect(user.provider == nil)
    }

    @Test("UserInfo can carry an explicit provider")
    func userInfo_carriesExplicitProvider() {
        let user = UserInfo(id: "1", email: "test@test.com", firstName: nil, provider: .email)
        #expect(user.provider == .email)
    }

    // MARK: - Provider-aware routing (the cold-start recovery fix)

    @Test("Email user mid-onboarding routes via .email case")
    func applyPostAuthDestination_emailUser_routesToEmailCase() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.hasReturningUser = false
        sut.returningUserFlagLoaded = true
        // pendingOnboardingData is nil by default → shouldRedirectToOnboarding returns true

        let emailUser = UserInfo(
            id: "email-user-1",
            email: "test@pulpe.app",
            firstName: nil,
            provider: .email
        )

        await sut.resolvePostAuth(user: emailUser)

        #expect(sut.pendingOnboardingUser == .email(emailUser))
        #expect(sut.hasReturningUser == false)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("Social (apple) user mid-onboarding routes via .social case")
    func applyPostAuthDestination_appleUser_routesToSocialCase() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.hasReturningUser = false
        sut.returningUserFlagLoaded = true

        let appleUser = UserInfo(
            id: "apple-user-1",
            email: "test@privaterelay.appleid.com",
            firstName: "Marie",
            provider: .apple
        )

        await sut.resolvePostAuth(user: appleUser)

        #expect(sut.pendingOnboardingUser == .social(appleUser))
        #expect(sut.hasReturningUser == false)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("Google user mid-onboarding routes via .social case")
    func applyPostAuthDestination_googleUser_routesToSocialCase() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.hasReturningUser = false
        sut.returningUserFlagLoaded = true

        let googleUser = UserInfo(
            id: "google-user-1",
            email: "test@gmail.com",
            firstName: "Luc",
            provider: .google
        )

        await sut.resolvePostAuth(user: googleUser)

        #expect(sut.pendingOnboardingUser == .social(googleUser))
    }

    @Test("Legacy user with nil provider falls back to .social case (safe default)")
    func applyPostAuthDestination_legacyUser_routesToSocialCase() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.hasReturningUser = false
        sut.returningUserFlagLoaded = true

        // Legacy user (pre-AuthProvider) — provider is nil
        let legacyUser = UserInfo(id: "legacy", email: "old@user.com", firstName: nil)

        await sut.resolvePostAuth(user: legacyUser)

        // Falls back to social routing (the existing behavior). Email users
        // without provider metadata are a rare edge case — they still get a
        // working flow via the existing `wasEmailRegistered` recovery in OnboardingFlow.
        #expect(sut.pendingOnboardingUser == .social(legacyUser))
    }

    // MARK: - abandonInProgressSignup

    @Test("abandonInProgressSignup clears email pending user and persisted draft")
    func abandonInProgressSignup_clearsEmailUserState() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(lastUsedEmail: "abandoned@test.com"),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        let stuckUser = UserInfo(
            id: "stuck",
            email: "abandoned@test.com",
            firstName: nil,
            provider: .email
        )
        sut.hasReturningUser = true
        sut.returningUserFlagLoaded = true
        sut.pendingOnboardingUser = .email(stuckUser)
        sut.currentUser = stuckUser

        // Seed UserDefaults with a partial onboarding state
        OnboardingState.clearPersistedData()
        let state = OnboardingState()
        state.firstName = "Marie"
        state.currentStep = .income
        state.saveToStorage()
        defer { OnboardingState.clearPersistedData() }

        await sut.abandonInProgressSignup()

        #expect(sut.pendingOnboardingUser == nil)
        #expect(sut.hasReturningUser == false)
        #expect(sut.currentUser == nil)

        // Verify the persisted onboarding state was wiped
        let restored = OnboardingState()
        #expect(restored.firstName.isEmpty)
        #expect(restored.currentStep == .welcome)
    }

    @Test("abandonInProgressSignup clears social pending user (social abandon path)")
    func abandonInProgressSignup_clearsSocialUserState() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.pendingOnboardingUser = .social(UserInfo(
            id: "social",
            email: "user@privaterelay.appleid.com",
            firstName: "Max",
            provider: .apple
        ))

        await sut.abandonInProgressSignup()

        #expect(sut.pendingOnboardingUser == nil)
    }

    /// `OnboardingFlow` keeps its `@State` across re-renders unless the view
    /// itself is re-instantiated — SwiftUI unit tests can't observe view
    /// lifecycle, so we assert the proxy: `onboardingSessionID` changes on
    /// abandon. `PulpeApp` uses it as `.id(...)` to force a fresh init,
    /// which reads the now-empty UserDefaults and lands back on `.welcome`.
    @Test("abandonInProgressSignup regenerates onboardingSessionID to force OnboardingFlow re-init")
    func abandonInProgressSignup_regeneratesSessionID() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        let originalSessionID = sut.onboardingSessionID
        sut.pendingOnboardingUser = .email(UserInfo(
            id: "stuck",
            email: "stuck@test.com",
            firstName: nil,
            provider: .email
        ))

        await sut.abandonInProgressSignup()

        #expect(sut.onboardingSessionID != originalSessionID)
    }

    // MARK: - OnboardingState.configureEmailUser preserves persistence

    @Test("configureEmailUser does NOT clear persisted onboarding data")
    func configureEmailUser_preservesPersistedState() {
        OnboardingState.clearPersistedData()
        defer { OnboardingState.clearPersistedData() }

        // Seed storage with a mid-flow state
        let seed = OnboardingState()
        seed.firstName = "Marie"
        seed.currentStep = .income
        seed.monthlyIncome = 5000
        seed.saveToStorage()

        // Load a fresh instance (simulates OnboardingFlow.init cold start)
        let restored = OnboardingState()
        #expect(restored.firstName == "Marie")
        #expect(restored.currentStep == .income)

        // Apply the recovered email user — must NOT wipe the loaded data
        restored.configureEmailUser(
            UserInfo(id: "1", email: "a@b.co", firstName: nil, provider: .email)
        )

        #expect(restored.firstName == "Marie")
        #expect(restored.currentStep == .income)
        #expect(restored.monthlyIncome == 5000)
        #expect(restored.isAuthenticated)
        #expect(restored.isSocialAuth == false)
    }

    @Test("cold-start resume advances past registration when persisted at .registration")
    func configureEmailUser_advancesPastRegistration_whenPersistedAtRegistrationStep() {
        OnboardingState.clearPersistedData()
        defer { OnboardingState.clearPersistedData() }

        // Seed storage mid-signup: the user was on .registration when the app died
        // right after Supabase created the account server-side. `saveToStorage()`
        // from the previous nextStep() call persisted `.registration`.
        let seed = OnboardingState()
        seed.firstName = "Max"
        seed.currentStep = .registration
        seed.saveToStorage()

        // Cold start: OnboardingFlow.init builds a fresh OnboardingState() which
        // loads the persisted draft — mirrors the real recovery path.
        let restored = OnboardingState()
        #expect(restored.currentStep == .registration, "persistence loads .registration")

        restored.configureEmailUser(
            UserInfo(id: "1", email: "max@test.com", firstName: "Max", provider: .email)
        )
        restored.resumeEmailUserAfterRegistration()

        #expect(
            restored.currentStep != .registration,
            "cold-start resume must advance past registration to avoid dead-end signup loop"
        )
        #expect(restored.isAuthenticated == true)
        #expect(restored.firstName == "Max", "persisted state preserved")
    }

    @Test("configureSocialUser DOES clear persisted data (unchanged behavior)")
    func configureSocialUser_clearsPersistedState() {
        OnboardingState.clearPersistedData()
        defer { OnboardingState.clearPersistedData() }

        // Seed storage with a mid-flow state
        let seed = OnboardingState()
        seed.firstName = "Marie"
        seed.currentStep = .income
        seed.saveToStorage()

        // Apply a fresh social user (different account) — should wipe stale draft
        seed.configureSocialUser(
            UserInfo(id: "social", email: "new@gmail.com", firstName: "Luc", provider: .google)
        )

        // Load a fresh instance: storage was cleared by configureSocialUser
        let restored = OnboardingState()
        #expect(restored.firstName.isEmpty || restored.firstName == "Luc")
        #expect(restored.currentStep == .welcome)
    }
}
