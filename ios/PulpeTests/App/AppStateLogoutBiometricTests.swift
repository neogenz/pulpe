import Foundation
@testable import Pulpe
import Supabase
import Testing

@MainActor
@Suite(.serialized)
struct AppStateLogoutBiometricTests {
    private static let manualBiometricRetryRequiredKey = "pulpe-manual-biometric-retry-required"
    private static let hasLaunchedBeforeKey = "pulpe-has-launched-before"
    private static let onboardingStorageKey = "pulpe-onboarding-data"

    init() {
        UserDefaults.standard.removeObject(forKey: Self.manualBiometricRetryRequiredKey)
    }

    @Test("Explicit logout signs out and clears biometric credentials")
    func logout_biometricEnabled_signsOutAndDisablesBiometric() async throws {
        let signOutCalled = AtomicFlag()
        let user = UserInfo(id: "user-1", email: "test@pulpe.app", firstName: "Max")
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(
                destination: .authenticated(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            biometricCapability: { true },
            performSignOut: { _ in signOutCalled.set() }
        )

        await sut.bootstrap()
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        try #require(sut.biometricEnabled)

        await sut.logout()

        #expect(signOutCalled.value)
        #expect(!sut.biometricEnabled)
        #expect(!sut.biometricCredentialsAvailable)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("Cold-start expiration preserves the Face ID preference without usable credentials")
    func checkAuthState_biometricEnabled_noSession_preservesPreference() async {
        UserDefaults.standard.set(true, forKey: Self.hasLaunchedBeforeKey)
        defer { UserDefaults.standard.removeObject(forKey: Self.hasLaunchedBeforeKey) }

        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            validateRegularSession: { nil },
            maintenanceChecking: { false }
        )

        await sut.checkAuthState()

        #expect(sut.biometricEnabled)
        #expect(!sut.biometricCredentialsAvailable)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("System logout preserves the Face ID preference without usable credentials")
    func systemLogout_preservesPreferenceAndClearsCredentials() async {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            performSignOut: { _ in }
        )
        await sut.bootstrap()
        sut.biometricCredentialsAvailable = true

        await sut.logout(source: .system)

        #expect(sut.biometricEnabled)
        #expect(!sut.biometricCredentialsAvailable)
        #expect(sut.authState == .unauthenticated)
    }

    @Test("startRecovery sets manual biometric retry flag")
    func startRecovery_setsManualRetryFlag() {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        sut.startRecovery()

        #expect(UserDefaults.standard.bool(forKey: Self.manualBiometricRetryRequiredKey))
        #expect(sut.authState == .needsPinRecovery)
    }

    @Test("cancelRecovery clears manual biometric retry flag")
    func cancelRecovery_clearsManualRetryFlag() {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        UserDefaults.standard.set(true, forKey: Self.manualBiometricRetryRequiredKey)
        sut.cancelRecovery()

        #expect(!UserDefaults.standard.bool(forKey: Self.manualBiometricRetryRequiredKey))
        #expect(sut.authState == .needsPinEntry)
    }

    @Test("completeRecovery clears manual biometric retry flag")
    func completeRecovery_clearsManualRetryFlag() async {
        let user = UserInfo(id: "recovery-user", email: "recovery@pulpe.app", firstName: "Recovery")
        let sut = AppState(
            postAuthResolver: MockPostAuthResolver(
                destination: .needsPinEntry(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        await sut.resolvePostAuth(user: user)
        sut.startRecovery()
        UserDefaults.standard.set(true, forKey: Self.manualBiometricRetryRequiredKey)

        await sut.completeRecovery()

        #expect(!UserDefaults.standard.bool(forKey: Self.manualBiometricRetryRequiredKey))
    }

    @Test("enterSignupFlow clears pending onboarding data")
    func enterSignupFlow_clearsPendingOnboardingData() {
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )
        sut.pendingOnboardingData = BudgetTemplateCreateFromOnboarding(name: "Stale Onboarding Data")

        sut.enterSignupFlow()

        #expect(sut.pendingOnboardingData == nil)
    }

    @Test("deleteAccount success clears returning-user markers and logs out globally")
    func deleteAccount_success_resetsStateAndCredentials() async {
        let user = UserInfo(id: "user-del", email: "delete@pulpe.app", firstName: "Del")
        let deleteCalled = AtomicFlag()
        let signOutScope = AtomicProperty<SignOutScope?>(nil)
        let keychain = AppStateTestFactory.keychainStore(lastUsedEmail: user.email)
        let sut = AppState(
            keychainManager: keychain,
            postAuthResolver: MockPostAuthResolver(
                destination: .authenticated(needsRecoveryKeyConsent: false)
            ),
            biometricPreferenceStore: AppStateTestFactory.biometricEnabledStore(),
            deleteAccountRequest: {
                deleteCalled.set()
                return DeleteAccountResponse(
                    success: true,
                    message: "scheduled",
                    scheduledDeletionAt: "2026-03-01T00:00:00Z"
                )
            },
            performSignOut: { scope in signOutScope.set(scope) }
        )

        await sut.bootstrap()
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        await sut.deleteAccount()

        #expect(deleteCalled.value)
        #expect(signOutScope.value == .global)
        #expect(sut.authState == .unauthenticated)
        #expect(!sut.hasReturningUser)
        #expect(!sut.biometricEnabled)
        #expect(await keychain.getLastUsedEmail() == nil)
    }

    @Test("OnboardingState clears persisted onboarding data")
    func onboardingState_clearsPersistedData() {
        let onboardingState = OnboardingState()
        onboardingState.firstName = "TestUser"
        onboardingState.currentStep = .charges
        onboardingState.saveToStorage()
        #expect(UserDefaults.standard.data(forKey: Self.onboardingStorageKey) != nil)

        OnboardingState.clearPersistedData()

        #expect(UserDefaults.standard.data(forKey: Self.onboardingStorageKey) == nil)
    }

    @Test("enterSignupFlow clears persisted onboarding data")
    func enterSignupFlow_clearsOnboardingPersistedData() {
        let onboardingState = OnboardingState()
        onboardingState.firstName = "TestUser"
        onboardingState.saveToStorage()
        let sut = AppState(
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        sut.enterSignupFlow()

        #expect(UserDefaults.standard.data(forKey: Self.onboardingStorageKey) == nil)
        #expect(!sut.hasReturningUser)
    }
}
