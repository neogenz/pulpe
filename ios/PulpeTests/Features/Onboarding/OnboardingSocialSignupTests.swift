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
    func isSocialAuth_falseByDefault() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        #expect(!state.isSocialAuth)
    }

    @Test
    func isSocialAuth_trueWhenSocialUserSet() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max"))
        #expect(state.isSocialAuth)
    }

    @Test
    func nextStep_socialUser_budgetPreview_setsReadyToComplete() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max"))
        state.currentStep = .budgetPreview
        state.nextStep()
        #expect(state.readyToComplete)
        #expect(state.currentStep == .budgetPreview)
    }

    @Test
    func nextStep_socialUserWithName_skipsFirstNameAndRegistration() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max"))
        // From welcome, social user with name should skip BOTH firstName AND registration → income
        state.currentStep = .welcome
        state.nextStep()
        #expect(state.currentStep == .income)
    }

    @Test
    func nextStep_socialUserWithoutName_showsFirstNameThenSkipsRegistration() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "apple-relay", email: "x@relay.appleid.com", firstName: nil))
        // From welcome, social user without name lands on firstName
        state.currentStep = .welcome
        state.nextStep()
        #expect(state.currentStep == .firstName)
        // After typing name, advancing skips registration → income
        state.firstName = "Marie"
        state.nextStep()
        #expect(state.currentStep == .income)
    }

    @Test
    func socialProvidedName_setOnlyWhenProviderGavesValidName() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.configureSocialUser(UserInfo(id: "1", email: "x@x.com", firstName: "Marie"))
        #expect(state.socialProvidedName)

        state.configureSocialUser(UserInfo(id: "2", email: "x@x.com", firstName: nil))
        #expect(!state.socialProvidedName)

        state.configureSocialUser(UserInfo(id: "3", email: "x@x.com", firstName: ""))
        #expect(!state.socialProvidedName)
    }

    @Test
    func progressBarSteps_socialUserWithName_excludesFirstNameAndRegistration() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "1", email: "x@x.com", firstName: "Marie"))
        #expect(state.progressBarSteps == [.income, .charges, .savings, .budgetPreview])
    }

    @Test
    func progressBarSteps_socialUserWithoutName_includesFirstName() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "1", email: "x@x.com", firstName: nil))
        #expect(state.progressBarSteps == [.firstName, .income, .charges, .savings, .budgetPreview])
    }

    @Test
    func progressBarSteps_emailUserUnauthenticated_includesAllExceptWelcome() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        #expect(state.progressBarSteps == [.firstName, .registration, .income, .charges, .savings, .budgetPreview])
    }

    @Test
    func progressBarSteps_emailUserAuthenticated_stillIncludesRegistration() {
        // Email users keep registration in their progress bar count even after signup,
        // so the total doesn't shrink mid-flow. Navigation still skips it (see nextStep tests).
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureEmailUser(UserInfo(id: "1", email: "x@x.com"))
        #expect(state.progressBarSteps == [.firstName, .registration, .income, .charges, .savings, .budgetPreview])
    }

    @Test
    func socialUser_withFirstName_nameFieldShouldBeHidden() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "apple-1", email: "apple@relay.appleid.com", firstName: "Marie"))
        #expect(state.isSocialAuth)
        #expect(state.isFirstNameValid)
        #expect(state.firstName == "Marie")
    }

    @Test
    func socialUser_withNilFirstName_nameFieldShouldRemainVisible() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "apple-2", email: "apple@relay.appleid.com", firstName: nil))
        #expect(state.isSocialAuth)
        #expect(!state.isFirstNameValid)
    }

    @Test
    func socialUser_withNilFirstName_cannotProceedWithoutName() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "apple-2b", email: "apple@relay.appleid.com", firstName: nil))
        state.monthlyIncome = 3000
        #expect(!state.canProceed(from: .firstName))
    }

    @Test
    func socialUser_withEmptyFirstName_nameFieldShouldRemainVisible() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureSocialUser(UserInfo(id: "apple-3", email: "apple@relay.appleid.com", firstName: ""))
        #expect(state.isSocialAuth)
        #expect(!state.isFirstNameValid)
    }

    @Test
    func progressPercentage_socialUser_budgetPreviewHigherThanNonSocial() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        // Without social: budgetPreview is last of 6 visible steps → 100%
        state.currentStep = .budgetPreview
        let nonSocialPercentage = state.progressPercentage

        // With social: registration excluded → 5 visible steps → 100%
        state.configureSocialUser(UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Max"))
        let socialPercentage = state.progressPercentage

        // Both hit 100% at budgetPreview (last step for both paths)
        #expect(socialPercentage == 100)
        #expect(nonSocialPercentage == 100)
    }
}
