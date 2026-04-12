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
    func canProceed_firstName_falseWhenEmpty() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = ""
        #expect(!state.canProceed(from: .firstName))
    }

    @Test
    func canProceed_firstName_falseWhenWhitespaceOnly() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "   "
        #expect(!state.canProceed(from: .firstName))
    }

    @Test
    func canProceed_firstName_trueWhenValid() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.firstName = "Max"
        #expect(state.canProceed(from: .firstName))
    }

    @Test
    func canProceed_income_falseWhenNil() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.monthlyIncome = nil
        #expect(!state.canProceed(from: .income))
    }

    @Test
    func canProceed_income_falseWhenZero() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.monthlyIncome = 0
        #expect(!state.canProceed(from: .income))
    }

    @Test
    func canProceed_income_trueWhenPositive() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.monthlyIncome = 3000
        #expect(state.canProceed(from: .income))
    }

    // MARK: - canProceed: Optional Steps

    @Test
    func canProceed_charges_alwaysTrue() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        #expect(state.canProceed(from: .charges))
    }

    @Test
    func canProceed_savings_alwaysTrue() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        #expect(state.canProceed(from: .savings))
    }

    // MARK: - Navigation: Forward Blocked When Invalid

    @Test
    func nextStep_advancesFromWelcomeToFirstName() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.currentStep = .welcome
        state.nextStep()
        #expect(state.currentStep == .firstName)
    }

    @Test
    func previousStep_goesBackFromFirstNameToWelcome() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.currentStep = .firstName
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
    func nextStep_setsReadyToCompleteAtBudgetPreview() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureEmailUser(UserInfo(id: "1", email: "t@t.com"))
        state.currentStep = .budgetPreview
        state.nextStep()
        #expect(state.readyToComplete)
        #expect(state.currentStep == .budgetPreview)
    }

    @Test
    func nextStep_authenticatedUser_skipsRegistrationForward() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureEmailUser(UserInfo(id: "1", email: "t@t.com"))
        state.currentStep = .firstName
        state.nextStep()
        #expect(state.currentStep == .income)
    }

    @Test
    func previousStep_authenticatedUser_skipsRegistrationBack() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.configureEmailUser(UserInfo(id: "1", email: "t@t.com"))
        state.currentStep = .income
        state.previousStep()
        #expect(state.currentStep == .firstName)
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
    func canSubmitRegistration_validEmail_returnsTrue() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.email = "max@example.com"
        #expect(state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_invalidEmail_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.email = "not-valid"
        #expect(!state.canSubmitRegistration)
    }

    @Test
    func canSubmitRegistration_isLoading_returnsFalse() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.email = "max@example.com"
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
    func progressPercentage_budgetPreviewIs100() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .budgetPreview
        #expect(state.progressPercentage == 100)
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
        state.currentStep = .charges
        state.saveToStorage()

        let restored = OnboardingState()
        #expect(restored.firstName == "Marie")
        #expect(restored.currentStep == .charges)
    }

    @Test
    func saveAndLoad_persistsDecimalFields() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Marie"
        state.currentStep = .savings
        state.monthlyIncome = 5000
        state.housingCosts = 1500
        state.healthInsurance = 400
        state.phonePlan = 50
        state.transportCosts = 100
        state.leasingCredit = 300
        state.saveToStorage()

        let restored = OnboardingState()
        #expect(restored.monthlyIncome == 5000)
        #expect(restored.housingCosts == 1500)
        #expect(restored.healthInsurance == 400)
        #expect(restored.phonePlan == 50)
        #expect(restored.transportCosts == 100)
        #expect(restored.leasingCredit == 300)
    }

    @Test
    func saveAndLoad_nilDecimalFieldsRemainNil() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Marie"
        state.currentStep = .income
        state.monthlyIncome = 5000
        state.saveToStorage()

        let restored = OnboardingState()
        #expect(restored.monthlyIncome == 5000)
        #expect(restored.housingCosts == nil)
        #expect(restored.healthInsurance == nil)
        #expect(restored.phonePlan == nil)
        #expect(restored.transportCosts == nil)
        #expect(restored.leasingCredit == nil)
    }

    // MARK: - Edit Round-Trip

    @Test
    func jumpToStepForEdit_setsReturnStepAndNavigates() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .budgetPreview
        state.jumpToStepForEdit(.income)

        #expect(state.currentStep == .income)
        #expect(state.editReturnStep == .budgetPreview)
    }

    @Test
    func nextStep_withEditReturn_returnsToPreview() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .income
        state.editReturnStep = .budgetPreview
        state.monthlyIncome = 5000

        state.nextStep()

        #expect(state.currentStep == .budgetPreview)
        #expect(state.editReturnStep == nil)
    }

    @Test
    func previousStep_withEditReturn_returnsToPreview() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.currentStep = .charges
        state.editReturnStep = .budgetPreview

        state.previousStep()

        #expect(state.currentStep == .budgetPreview)
        #expect(state.editReturnStep == nil)
    }

    @Test
    func clearStorage_removesPersistedData() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.firstName = "Marie"
        state.currentStep = .charges
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
            description: nil
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
            description: nil
        )
        let tx2 = OnboardingTransaction(
            amount: 30, type: .expense, name: "Netflix",
            description: nil
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
            description: nil
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
            description: nil
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
            description: nil
        )
        let tx2 = OnboardingTransaction(
            amount: 30, type: .saving, name: "Épargne",
            description: nil
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
            description: nil
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
        #expect(OnboardingState.chargeSuggestions.count == 3)
        #expect(OnboardingState.savingSuggestions.count == 2)
    }

    // MARK: - T1.1 Regression: toggle → edit amount → re-toggle does not duplicate

    /// Reproduction sequence for the original duplicate-entry bug:
    ///   1. Toggle chip ON (suggestion appended at its static amount)
    ///   2. User opens the edit sheet on the row, mutates the amount via `replaceCustomTransaction`
    ///   3. Triple-match identity USED to fail because the amount changed → chip rendered as unselected
    ///   4. Re-tap appended a duplicate → `availableToSpend` inflated
    /// After the fix, identity is `name + type` only, so the chip stays selected after edit
    /// and re-tap removes (not duplicates) the entry. Iterates over every suggestion to
    /// guarantee both expense and saving paths are covered.
    @Test
    func toggleSuggestion_afterAmountEdit_doesNotDuplicate_allSuggestions() {
        for suggestion in OnboardingState.suggestions {
            let state = makeSUT()
            defer { OnboardingState.clearPersistedData() }

            state.toggleSuggestion(suggestion)
            #expect(state.customTransactions.count == 1)

            // Simulate the edit sheet flow: replace by id with a new amount.
            let original = state.customTransactions[0]
            let edited = OnboardingTransaction(
                id: original.id,
                amount: original.amount + 200,
                type: original.type,
                name: original.name,
                description: original.description,
                expenseType: original.expenseType,
                isRecurring: original.isRecurring
            )
            state.replaceCustomTransaction(id: original.id, with: edited)

            #expect(state.customTransactions.count == 1)
            #expect(state.customTransactions[0].amount == original.amount + 200)

            // Chip stays selected — identity is (name, type) only.
            #expect(state.isSuggestionSelected(suggestion))

            // Re-toggle removes the entry — does NOT append a duplicate.
            state.toggleSuggestion(suggestion)
            #expect(state.customTransactions.isEmpty)
        }
    }

    @Test
    func toggleSuggestion_afterAmountEdit_neverInflatesAvailableToSpend() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }
        state.monthlyIncome = 5000

        let suggestion = OnboardingState.suggestions[0] // Courses, 600 expense
        state.toggleSuggestion(suggestion)

        let original = state.customTransactions[0]
        let edited = OnboardingTransaction(
            id: original.id,
            amount: 800,
            type: original.type,
            name: original.name
        )
        state.replaceCustomTransaction(id: original.id, with: edited)

        // Re-toggle removes the entry rather than adding a duplicate at 600.
        state.toggleSuggestion(suggestion)

        #expect(state.customTransactions.isEmpty)
        #expect(state.availableToSpend == 5000)
    }

    // MARK: - Running Totals

    @Test
    func totalCharges_includesHardcodedAndCustomExpenses() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.housingCosts = 1500
        state.healthInsurance = 400
        let tx = OnboardingTransaction(
            amount: 50, type: .expense, name: "Spotify",
            description: nil
        )
        state.addCustomTransaction(tx)

        #expect(state.totalCharges == 1950)
    }

    @Test
    func totalCharges_excludesSavings() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.housingCosts = 1500
        let saving = OnboardingTransaction(
            amount: 500, type: .saving, name: "Épargne",
            description: nil
        )
        state.addCustomTransaction(saving)

        #expect(state.totalCharges == 1500)
    }

    @Test
    func totalSavings_onlyIncludesSavingType() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        let saving = OnboardingTransaction(
            amount: 500, type: .saving, name: "Épargne",
            description: nil
        )
        let expense = OnboardingTransaction(
            amount: 100, type: .expense, name: "Spotify",
            description: nil
        )
        state.addCustomTransaction(saving)
        state.addCustomTransaction(expense)

        #expect(state.totalSavings == 500)
    }

    @Test
    func totalIncome_includesMainAndCustomIncomes() {
        let state = makeSUT()
        defer { OnboardingState.clearPersistedData() }

        state.monthlyIncome = 5000
        let extraIncome = OnboardingTransaction(
            amount: 500, type: .income, name: "Freelance",
            description: nil
        )
        state.addCustomTransaction(extraIncome)

        #expect(state.totalIncome == 5500)
    }
}
