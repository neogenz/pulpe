import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
struct OnboardingSocialSignupTests {
    private func makeSUT() -> OnboardingState {
        OnboardingState.clearPersistedData()
        let state = OnboardingState()
        state.currentStep = .welcome
        return state
    }

    // MARK: - Social Signup

    @Test
    func isSocialSignup_falseByDefault() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        #expect(!state.isSocialSignup)
    }

    @Test
    func isSocialSignup_trueWhenSocialUserSet() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.socialUser = UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max")
        #expect(state.isSocialSignup)
    }

    @Test
    func nextStep_socialUser_skipsRegistration_setsReadyForSocialCompletion() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.socialUser = UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max")
        state.currentStep = .budgetPreview
        state.nextStep()
        #expect(state.readyForSocialCompletion)
        #expect(state.currentStep == .budgetPreview)
    }

    @Test
    func nextStep_noSocialUser_advancesToRegistration() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .budgetPreview
        state.nextStep()
        #expect(state.currentStep == .registration)
        #expect(!state.readyForSocialCompletion)
    }

    @Test
    func progressPercentage_socialUser_budgetPreviewHigherThanNonSocial() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        // Without social: budgetPreview is 50% (2/4 non-welcome steps)
        state.currentStep = .budgetPreview
        let nonSocialPercentage = state.progressPercentage

        // With social: budgetPreview is 66.7% (2/3 non-welcome steps)
        state.socialUser = UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max")
        let socialPercentage = state.progressPercentage

        #expect(socialPercentage > nonSocialPercentage)
    }
}
