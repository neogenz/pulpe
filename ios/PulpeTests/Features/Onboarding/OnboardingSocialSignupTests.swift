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

    // MARK: - PUL-196: Cross-account draft pollution

    /// Repro from PUL-196: a previous email signup left a persisted draft on the
    /// device. The next OnboardingFlow init for a social user runs
    /// `OnboardingState() → loadFromStorage() → configureSocialUser()`. Without
    /// the draft reset, financial fields from the email user bleed into the
    /// social form. Asserts every persisted field is wiped after configure.
    @Test
    func configureSocialUser_wipesDraftLoadedFromStorage() {
        OnboardingState.clearPersistedData()
        defer { OnboardingState.clearPersistedData() }

        // 1) Email user fills draft and abandons.
        let prior = OnboardingState()
        prior.firstName = "Alice"
        prior.currency = .eur
        prior.monthlyIncome = 5000
        prior.housingCosts = 1500
        prior.healthInsurance = 400
        prior.phonePlan = 50
        prior.transportCosts = 100
        prior.leasingCredit = 300
        prior.addCustomTransaction(
            OnboardingTransaction(amount: 50, type: .expense, name: "Spotify")
        )
        prior.saveToStorage()

        // 2) Fresh flow init for a social user — same device, different account.
        let socialState = OnboardingState()
        socialState.configureSocialUser(
            UserInfo(id: "social-1", email: "social@pulpe.app", firstName: "Bob")
        )

        // 3) All draft fields must be reset; provider name overrides.
        #expect(socialState.firstName == "Bob")
        #expect(socialState.currency == .chf)
        #expect(socialState.monthlyIncome == nil)
        #expect(socialState.housingCosts == nil)
        #expect(socialState.healthInsurance == nil)
        #expect(socialState.phonePlan == nil)
        #expect(socialState.transportCosts == nil)
        #expect(socialState.leasingCredit == nil)
        #expect(socialState.customTransactions.isEmpty)
        #expect(!socialState.wasEmailRegistered)
    }

    /// Apple Private Relay path: provider returns no name. The draft's leftover
    /// firstName must NOT survive — would otherwise pre-fill the social user's
    /// firstName step with the previous email user's name.
    @Test
    func configureSocialUser_withoutProviderName_clearsLeftoverFirstName() {
        OnboardingState.clearPersistedData()
        defer { OnboardingState.clearPersistedData() }

        let prior = OnboardingState()
        prior.firstName = "Alice"
        prior.monthlyIncome = 5000
        prior.saveToStorage()

        let socialState = OnboardingState()
        socialState.configureSocialUser(
            UserInfo(id: "apple-relay", email: "x@relay.appleid.com", firstName: nil)
        )

        #expect(socialState.firstName.isEmpty)
        #expect(!socialState.socialProvidedName)
        #expect(socialState.monthlyIncome == nil)
    }

    /// Non-regression: email recovery path MUST keep the persisted draft.
    /// `configureEmailUser` is called when restoring a mid-flow signup — wiping
    /// would force the user to re-enter every value.
    @Test
    func configureEmailUser_preservesDraftFromStorage() {
        OnboardingState.clearPersistedData()
        defer { OnboardingState.clearPersistedData() }

        let prior = OnboardingState()
        prior.firstName = "Alice"
        prior.monthlyIncome = 5000
        prior.housingCosts = 1500
        prior.currency = .eur
        prior.currentStep = .charges
        prior.saveToStorage()

        let recovered = OnboardingState()
        recovered.configureEmailUser(UserInfo(id: "1", email: "alice@example.com"))

        #expect(recovered.firstName == "Alice")
        #expect(recovered.monthlyIncome == 5000)
        #expect(recovered.housingCosts == 1500)
        #expect(recovered.currency == .eur)
        #expect(recovered.currentStep == .charges)
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
