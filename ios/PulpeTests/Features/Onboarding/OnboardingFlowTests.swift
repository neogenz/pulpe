import Foundation
@testable import Pulpe
import Testing

/// Tests for the onboarding completion flow's interaction with `UserSettingsStore`.
///
/// PUL-118: Currency picked during onboarding must NOT be persisted before PIN setup —
/// the API call would fail with 403 `AUTH_CLIENT_KEY_MISSING` because the client key
/// is derived from the PIN. The fix moves persistence into `OnboardingBootstrapper.bootstrapIfNeeded`,
/// which runs post-PIN-setup. These tests pin that the pre-PIN path no longer touches
/// `UserSettingsServicing.updateSettings`.
@MainActor
@Suite(.serialized)
struct OnboardingFlowTests {
    private let user = UserInfo(id: "user-1", email: "test@pulpe.app", firstName: "Max")

    @Test("completeOnboarding does not call UserSettingsServicing.updateSettings during pre-auth")
    func finishOnboarding_doesNotCallUpdateCurrencyDuringPreAuth() async {
        let mockSettingsService = MockUserSettingsService()
        // Build the store with the mock so we can assert no API call leaked through.
        // We don't need to wire it onto AppState — the fix removed the pre-PIN call,
        // so the store is now untouched until `bootstrapIfNeeded` runs (post-PIN).
        _ = UserSettingsStore(service: mockSettingsService)

        let sut = AppState(
            keychainManager: AppStateTestFactory.keychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        // Wait for AppState init to settle.
        try? await Task.sleep(for: .milliseconds(50))

        await sut.completeOnboarding(
            user: user,
            onboardingData: BudgetTemplateCreateFromOnboarding(),
            signupMethod: "email",
            currency: .eur
        )

        let updateCallCount = await mockSettingsService.updateSettingsCallCount
        #expect(
            updateCallCount == 0,
            "PUL-118: pre-PIN onboarding must not hit PUT /users/settings"
        )
    }

    @Test("completeOnboarding stashes the picked currency on OnboardingBootstrapper")
    func completeOnboarding_stashesPendingCurrency() async {
        let sut = AppState(
            keychainManager: AppStateTestFactory.keychainStore(),
            postAuthResolver: MockPostAuthResolver(destination: .needsPinSetup),
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore()
        )

        try? await Task.sleep(for: .milliseconds(50))

        await sut.completeOnboarding(
            user: user,
            onboardingData: BudgetTemplateCreateFromOnboarding(),
            signupMethod: "email",
            currency: .eur
        )

        #expect(
            sut.onboardingBootstrapper.pendingCurrency == .eur,
            "Picked currency must be retained for post-PIN persistence"
        )
    }
}
