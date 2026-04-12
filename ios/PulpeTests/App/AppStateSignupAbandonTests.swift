import Foundation
@testable import Pulpe
import Testing

/// Tests for the mid-onboarding signup abandon flow and provider-aware routing.
///
/// Covers three bug fixes:
/// 1. `AuthProvider.fromSupabase` parses Supabase app_metadata.provider values
/// 2. `applyPostAuthDestination` routes email users via `pendingEmailUser`, social users via `pendingSocialUser`
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

    @Test("Email user mid-onboarding routes to pendingEmailUser (not pendingSocialUser)")
    func applyPostAuthDestination_emailUser_routesToPendingEmail() async {
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

        #expect(sut.pendingEmailUser?.id == "email-user-1")
        #expect(sut.pendingSocialUser == nil)
        #expect(sut.hasReturningUser == false)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("Social (apple) user mid-onboarding routes to pendingSocialUser")
    func applyPostAuthDestination_appleUser_routesToPendingSocial() async {
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

        #expect(sut.pendingSocialUser?.id == "apple-user-1")
        #expect(sut.pendingEmailUser == nil)
        #expect(sut.hasReturningUser == false)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("Google user mid-onboarding routes to pendingSocialUser")
    func applyPostAuthDestination_googleUser_routesToPendingSocial() async {
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

        #expect(sut.pendingSocialUser?.id == "google-user-1")
        #expect(sut.pendingEmailUser == nil)
    }

    @Test("Legacy user with nil provider falls back to pendingSocialUser (safe default)")
    func applyPostAuthDestination_legacyUser_routesToPendingSocial() async {
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
        #expect(sut.pendingSocialUser?.id == "legacy")
        #expect(sut.pendingEmailUser == nil)
    }

    // MARK: - abandonInProgressSignup

    @Test("abandonInProgressSignup clears email user pending state")
    func abandonInProgressSignup_clearsEmailUserState() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(lastUsedEmail: "abandoned@test.com"),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.hasReturningUser = true
        sut.returningUserFlagLoaded = true
        sut.pendingEmailUser = UserInfo(
            id: "stuck",
            email: "abandoned@test.com",
            firstName: nil,
            provider: .email
        )
        sut.currentUser = sut.pendingEmailUser

        // Seed UserDefaults with a partial onboarding state
        OnboardingState.clearPersistedData()
        let state = OnboardingState()
        state.firstName = "Marie"
        state.currentStep = .income
        state.saveToStorage()
        defer { OnboardingState.clearPersistedData() }

        await sut.abandonInProgressSignup()

        #expect(sut.pendingEmailUser == nil)
        #expect(sut.pendingSocialUser == nil)
        #expect(sut.hasReturningUser == false)
        #expect(sut.currentUser == nil)

        // Verify the persisted onboarding state was wiped
        let restored = OnboardingState()
        #expect(restored.firstName.isEmpty)
        #expect(restored.currentStep == .welcome)
    }

    @Test("abandonInProgressSignup also clears pendingSocialUser (social abandon path)")
    func abandonInProgressSignup_clearsSocialUserState() async {
        let sut = AppState(
            keychainManager: MockKeychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            biometricOptOutStore: AppStateTestFactory.cleanOptOutStore
        )
        sut.pendingSocialUser = UserInfo(
            id: "social",
            email: "user@privaterelay.appleid.com",
            firstName: "Max",
            provider: .apple
        )

        await sut.abandonInProgressSignup()

        #expect(sut.pendingSocialUser == nil)
        #expect(sut.pendingEmailUser == nil)
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
