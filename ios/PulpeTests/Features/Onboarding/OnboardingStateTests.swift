import Foundation
import Testing
@testable import Pulpe

@Suite(.serialized)
@MainActor
struct OnboardingStateTests {

    /// Creates a clean OnboardingState for testing.
    /// Clears persisted data to ensure test isolation, then sets initial step to .welcome.
    private func makeSUT() -> OnboardingState {
        OnboardingState.clearPersistedData()
        let state = OnboardingState()
        state.currentStep = .welcome
        return state
    }

    // MARK: - canProceed: Required Steps

    @Test
    func canProceed_welcomeStep_alwaysTrue() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        #expect(state.canProceed(from: .welcome))
    }

    @Test
    func canProceed_personalInfo_falseWhenEmpty() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = ""
        #expect(!state.canProceed(from: .personalInfo))
    }

    @Test
    func canProceed_personalInfo_falseWhenWhitespaceOnly() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "   "
        #expect(!state.canProceed(from: .personalInfo))
    }

    @Test
    func canProceed_personalInfo_trueWhenValid() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "Max"
        state.monthlyIncome = 3000
        #expect(state.canProceed(from: .personalInfo))
    }

    @Test
    func canProceed_personalInfo_falseWhenIncomeNil() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "Max"
        state.monthlyIncome = nil
        #expect(!state.canProceed(from: .personalInfo))
    }

    @Test
    func canProceed_personalInfo_falseWhenIncomeZero() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "Max"
        state.monthlyIncome = 0
        #expect(!state.canProceed(from: .personalInfo))
    }

    @Test
    func canProceed_personalInfo_trueWhenIncomePositive() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "Max"
        state.monthlyIncome = 3000
        #expect(state.canProceed(from: .personalInfo))
    }

    // MARK: - canProceed: Optional Steps

    @Test
    func canProceed_optionalSteps_alwaysTrue() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        #expect(state.canProceed(from: .expenses))
    }

    // MARK: - Navigation: Forward Blocked When Invalid

    @Test
    func nextStep_advancesWhenValid() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.currentStep = .welcome
        state.nextStep()
        #expect(state.currentStep == .personalInfo)
    }

    @Test
    func previousStep_goesBackFromSecondStep() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.currentStep = .personalInfo
        state.previousStep()
        #expect(state.currentStep == .welcome)
    }

    @Test
    func previousStep_doesNothingAtWelcome() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.currentStep = .welcome
        state.previousStep()
        #expect(state.currentStep == .welcome)
    }

    @Test
    func nextStep_doesNothingAtLastStep() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.currentStep = .registration
        state.nextStep()
        #expect(state.currentStep == .registration)
    }
}
