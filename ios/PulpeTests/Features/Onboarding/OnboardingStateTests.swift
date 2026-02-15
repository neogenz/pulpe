import XCTest
@testable import Pulpe

@MainActor
final class OnboardingStateTests: XCTestCase {

    private var state: OnboardingState!

    override func setUp() {
        super.setUp()
        state = OnboardingState()
        OnboardingState.clearPersistedData()
        state.currentStep = .welcome
    }

    // MARK: - canProceed: Required Steps

    func testCanProceed_welcomeStep_alwaysTrue() {
        XCTAssertTrue(state.canProceed(from: .welcome))
    }

    func testCanProceed_personalInfo_falseWhenEmpty() {
        state.firstName = ""
        XCTAssertFalse(state.canProceed(from: .personalInfo))
    }

    func testCanProceed_personalInfo_falseWhenWhitespaceOnly() {
        state.firstName = "   "
        XCTAssertFalse(state.canProceed(from: .personalInfo))
    }

    func testCanProceed_personalInfo_trueWhenValid() {
        state.firstName = "Max"
        state.monthlyIncome = 3000
        XCTAssertTrue(state.canProceed(from: .personalInfo))
    }

    func testCanProceed_personalInfo_falseWhenIncomeNil() {
        state.firstName = "Max"
        state.monthlyIncome = nil
        XCTAssertFalse(state.canProceed(from: .personalInfo))
    }

    func testCanProceed_personalInfo_falseWhenIncomeZero() {
        state.firstName = "Max"
        state.monthlyIncome = 0
        XCTAssertFalse(state.canProceed(from: .personalInfo))
    }

    func testCanProceed_personalInfo_trueWhenIncomePositive() {
        state.firstName = "Max"
        state.monthlyIncome = 3000
        XCTAssertTrue(state.canProceed(from: .personalInfo))
    }

    // MARK: - canProceed: Optional Steps

    func testCanProceed_optionalSteps_alwaysTrue() {
        XCTAssertTrue(state.canProceed(from: .expenses), "Expected canProceed to be true for optional step expenses")
    }

    // MARK: - Navigation: Forward Blocked When Invalid

    func testNextStep_advancesWhenValid() {
        state.currentStep = .welcome
        state.nextStep()
        XCTAssertEqual(state.currentStep, .personalInfo)
    }

    func testPreviousStep_goesBackFromSecondStep() {
        state.currentStep = .personalInfo
        state.previousStep()
        XCTAssertEqual(state.currentStep, .welcome)
    }

    func testPreviousStep_doesNothingAtWelcome() {
        state.currentStep = .welcome
        state.previousStep()
        XCTAssertEqual(state.currentStep, .welcome)
    }

    func testNextStep_doesNothingAtLastStep() {
        state.currentStep = .registration
        state.nextStep()
        XCTAssertEqual(state.currentStep, .registration)
    }
}
