// swiftlint:disable file_length type_body_length
import Foundation
@testable import Pulpe
import Testing

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

    // MARK: - Email Validation

    @Test(arguments: ["user@example.com", "test.user@domain.org", "a@b.co", "user+tag@gmail.com"])
    func isEmailValid_validEmails(email: String) {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.email = email
        #expect(state.isEmailValid)
    }

    @Test(arguments: ["", "not-an-email", "@domain.com", "user@", "user@domain", "user @example.com"])
    func isEmailValid_invalidEmails(email: String) {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.email = email
        #expect(!state.isEmailValid)
    }

    // MARK: - canSubmitRegistration

    @Test
    func canSubmitRegistration_allValid_returnsTrue() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Max"
        state.monthlyIncome = 5000
        state.email = "max@example.com"
        state.acceptTerms = true
        #expect(state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_missingFirstName_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.monthlyIncome = 5000
        state.email = "max@example.com"
        state.acceptTerms = true
        #expect(!state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_missingIncome_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Max"
        state.email = "max@example.com"
        state.acceptTerms = true
        #expect(!state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_invalidEmail_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Max"
        state.monthlyIncome = 5000
        state.email = "not-valid"
        state.acceptTerms = true
        #expect(!state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_termsNotAccepted_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Max"
        state.monthlyIncome = 5000
        state.email = "max@example.com"
        state.acceptTerms = false
        #expect(!state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_isLoading_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Max"
        state.monthlyIncome = 5000
        state.email = "max@example.com"
        state.acceptTerms = true
        state.isLoading = true
        #expect(!state.canSubmitRegistration)
    }

    // MARK: - Expenses Calculations

    @Test
    func totalExpenses_allNil_returnsZero() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        #expect(state.totalExpenses == 0)
    }

    @Test
    func totalExpenses_mixedValues_returnsSumOfNonNil() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.housingCosts = 1500
        state.healthInsurance = 400
        state.transportCosts = 100
        #expect(state.totalExpenses == 2000)
    }

    @Test
    func availableToSpend_incomeMinusExpenses() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.monthlyIncome = 5000
        state.housingCosts = 1500
        state.healthInsurance = 400
        #expect(state.availableToSpend == 3100)
    }

    @Test
    func availableToSpend_noIncome_returnsNegativeExpenses() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.housingCosts = 1500
        #expect(state.availableToSpend == -1500)
    }

    // MARK: - Progress

    @Test
    func progressPercentage_welcomeIsZero() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .welcome
        #expect(state.progressPercentage == 0)
    }

    @Test
    func progressPercentage_registrationIsMax() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .registration
        // 5 steps, welcome excluded → registration is index 3 of 4 = 75%
        #expect(state.progressPercentage == 75)
    }

    @Test
    func progressPercentage_increasesMonotonically() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        var previousPercentage: Double = -1
        for step in OnboardingStep.allCases {
            state.currentStep = step
            #expect(state.progressPercentage >= previousPercentage)
            previousPercentage = state.progressPercentage
        }
    }

    // MARK: - Persistence

    @Test
    func saveAndLoad_roundTrips() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Marie"
        state.currentStep = .expenses
        state.saveToStorage()

        let restored = OnboardingState()
        #expect(restored.firstName == "Marie")
        #expect(restored.currentStep == .expenses)
    }

    @Test
    func clearStorage_removesPersistedData() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Marie"
        state.currentStep = .expenses
        state.saveToStorage()
        state.clearStorage()

        let restored = OnboardingState()
        #expect(restored.firstName.isEmpty)
        #expect(restored.currentStep == .welcome)
    }

    // MARK: - Template Creation

    @Test
    func createTemplateData_mapsFieldsCorrectly() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.monthlyIncome = 5000
        state.housingCosts = 1500
        state.healthInsurance = 400
        state.phonePlan = 50
        state.transportCosts = 100
        state.leasingCredit = 300

        let template = state.createTemplateData()
        #expect(template.name == "Mois Standard")
        #expect(template.description == "Créé pendant l'inscription")
        #expect(template.isDefault == true)
        #expect(template.monthlyIncome == 5000)
        #expect(template.housingCosts == 1500)
        #expect(template.healthInsurance == 400)
        #expect(template.phonePlan == 50)
        #expect(template.transportCosts == 100)
        #expect(template.leasingCredit == 300)
    }

    @Test
    func createTemplateData_nilExpensesRemainNil() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.monthlyIncome = 5000

        let template = state.createTemplateData()
        #expect(template.monthlyIncome == 5000)
        #expect(template.housingCosts == nil)
        #expect(template.healthInsurance == nil)
        #expect(template.phonePlan == nil)
        #expect(template.transportCosts == nil)
        #expect(template.leasingCredit == nil)
    }

    // MARK: - Custom Transactions

    @Test
    func addCustomTransaction_appendsToArray() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let tx = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        state.addCustomTransaction(tx)

        #expect(state.customTransactions.count == 1)
        #expect(state.customTransactions[0].name == "Spotify")
        #expect(state.customTransactions[0].amount == 50)
    }

    @Test
    func removeCustomTransaction_removesAtIndex() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let tx1 = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        let tx2 = OnboardingTransaction(
            amount: 30, type: .expense, name: "Netflix",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        state.addCustomTransaction(tx1)
        state.addCustomTransaction(tx2)
        state.removeCustomTransaction(at: 0)

        #expect(state.customTransactions.count == 1)
        #expect(state.customTransactions[0].name == "Netflix")
    }

    @Test
    func totalExpenses_includesCustomTransactions() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.housingCosts = 1500
        let tx = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        state.addCustomTransaction(tx)

        #expect(state.totalExpenses == 1550)
    }

    @Test
    func createTemplateData_mapsCustomTransactions() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let tx = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        state.addCustomTransaction(tx)

        let template = state.createTemplateData()
        #expect(template.customTransactions.count == 1)
        #expect(template.customTransactions[0].name == "Spotify")
        #expect(template.customTransactions[0].amount == 50)
        #expect(template.customTransactions[0].type == .expense)
        #expect(template.customTransactions[0].expenseType == .fixed)
    }

    @Test
    func updateCustomTransactionAmount_updatesCorrectIndex() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let tx1 = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        let tx2 = OnboardingTransaction(
            amount: 30, type: .saving, name: "Épargne",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        state.addCustomTransaction(tx1)
        state.addCustomTransaction(tx2)
        state.updateCustomTransactionAmount(at: 1, amount: 100)

        #expect(state.customTransactions[0].amount == 50)
        #expect(state.customTransactions[1].amount == 100)
        #expect(state.customTransactions[1].name == "Épargne")
        #expect(state.customTransactions[1].type == .saving)
    }

    @Test
    func updateCustomTransactionAmount_outOfBounds_doesNothing() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let tx = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil, expenseType: .fixed, isRecurring: true
        )
        state.addCustomTransaction(tx)
        state.updateCustomTransactionAmount(at: 5, amount: 100)

        #expect(state.customTransactions.count == 1)
        #expect(state.customTransactions[0].amount == 50)
    }

    // MARK: - Suggestion Toggle

    @Test
    func toggleSuggestion_addsWhenNotSelected() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let suggestion = OnboardingState.suggestions[0]
        state.toggleSuggestion(suggestion)

        #expect(state.customTransactions.count == 1)
        #expect(state.customTransactions[0].name == suggestion.name)
        #expect(state.customTransactions[0].amount == suggestion.amount)
    }

    @Test
    func toggleSuggestion_removesWhenAlreadySelected() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let suggestion = OnboardingState.suggestions[0]
        state.toggleSuggestion(suggestion)
        #expect(state.customTransactions.count == 1)

        state.toggleSuggestion(suggestion)
        #expect(state.customTransactions.isEmpty)
    }

    @Test
    func isSuggestionSelected_returnsTrueWhenPresent() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let suggestion = OnboardingState.suggestions[0]
        #expect(!state.isSuggestionSelected(suggestion))

        state.toggleSuggestion(suggestion)
        #expect(state.isSuggestionSelected(suggestion))
    }

    @Test
    func toggleSuggestion_doesNotAffectOtherSuggestions() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let first = OnboardingState.suggestions[0]
        let second = OnboardingState.suggestions[1]
        state.toggleSuggestion(first)
        state.toggleSuggestion(second)

        #expect(state.customTransactions.count == 2)

        state.toggleSuggestion(first)
        #expect(state.customTransactions.count == 1)
        #expect(state.customTransactions[0].name == second.name)
    }

    @Test
    func totalExpenses_includesSuggestions() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.housingCosts = 1500
        let suggestion = OnboardingState.suggestions[0] // 600
        state.toggleSuggestion(suggestion)

        #expect(state.totalExpenses == 2100)
    }

    @Test
    func suggestions_hasExpectedCount() {
        #expect(OnboardingState.suggestions.count == 5)
    }
}
