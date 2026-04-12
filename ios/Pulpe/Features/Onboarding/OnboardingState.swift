import Foundation
import SwiftUI

/// State for the onboarding flow
@Observable @MainActor
final class OnboardingState {
    // MARK: - Data

    var firstName: String = ""
    var monthlyIncome: Decimal?
    var housingCosts: Decimal?
    var healthInsurance: Decimal?
    var phonePlan: Decimal?
    var transportCosts: Decimal?
    var leasingCredit: Decimal?
    var customTransactions: [OnboardingTransaction] = []

    // MARK: - Registration

    var email: String = ""

    // MARK: - Auth State

    /// The authenticated user — set from both social auth (WelcomeStep) and email registration.
    var authenticatedUser: UserInfo?
    var isAuthenticated: Bool { authenticatedUser != nil }

    /// True only for social provider auth (Apple/Google) — drives the firstName/registration skips.
    private(set) var isSocialAuth: Bool = false
    var isSocialSignup: Bool { isSocialAuth }

    /// True when the social provider supplied a valid first name at auth time.
    /// Set once in `configureSocialUser` so the visible step count doesn't shift
    /// while the user is interacting with the form.
    private(set) var socialProvidedName: Bool = false

    /// Triggers `finishOnboarding` from BudgetPreview (the finale) for all auth paths.
    var readyToComplete: Bool = false

    /// Set when email registration was persisted — used for cold-start session recovery.
    private(set) var wasEmailRegistered: Bool = false

    /// Configures state for a social signup user.
    /// Pre-fills firstName from provider metadata and clears persisted step
    /// so cold-start after app kill resets to welcome.
    func configureSocialUser(_ user: UserInfo) {
        authenticatedUser = user
        isSocialAuth = true
        if let name = user.firstName, !name.isEmpty {
            firstName = name
            socialProvidedName = true
        } else {
            socialProvidedName = false
        }
        clearStorage()
    }

    func configureEmailUser(_ user: UserInfo) {
        authenticatedUser = user
        isSocialAuth = false
        socialProvidedName = false
    }

    // MARK: - UI State

    var currentStep: OnboardingStep = .welcome
    var isLoading: Bool = false
    var error: Error?
    var isMovingForward: Bool = true
    var hasCompleted: Bool = false
    var hasAbandoned: Bool = false
    var isSubmitting: Bool = false

    /// When set, nextStep()/previousStep() return to this step instead of sequential navigation.
    /// Used by BudgetPreview to round-trip edits back to the preview.
    var editReturnStep: OnboardingStep?

    // MARK: - Persistence Keys

    private static let storageKey = "pulpe-onboarding-data"

    // MARK: - Init

    init() {
        loadFromStorage()
    }

    // MARK: - Computed

    var isFirstNameValid: Bool {
        !firstName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var isIncomeValid: Bool {
        guard let income = monthlyIncome else { return false }
        return income > 0
    }

    var isEmailValid: Bool {
        email.isValidEmail
    }

    var canSubmitRegistration: Bool {
        isEmailValid && !isLoading
    }

    /// firstName is hidden for social users with a provider name (Apple App Store rejects asking).
    /// registration is hidden once authenticated (social bypass + email already done).
    private func isStepVisible(_ step: OnboardingStep) -> Bool {
        switch step {
        case .welcome:
            return true
        case .firstName:
            return !(isSocialAuth && socialProvidedName)
        case .registration:
            return !isAuthenticated
        case .income, .charges, .savings, .budgetPreview:
            return true
        }
    }

    /// Steps shown in the progress bar (excludes welcome since it has no progress bar).
    var progressBarSteps: [OnboardingStep] {
        OnboardingStep.allCases.filter { $0 != .welcome && isStepVisible($0) }
    }

    private func nextVisibleStep(after index: Int) -> OnboardingStep? {
        let allCases = OnboardingStep.allCases
        guard index + 1 < allCases.count else { return nil }
        return allCases[(index + 1)...].first { isStepVisible($0) }
    }

    private func previousVisibleStep(before index: Int) -> OnboardingStep? {
        guard index > 0 else { return nil }
        return OnboardingStep.allCases[..<index].reversed().first { isStepVisible($0) }
    }

    var progressPercentage: Double {
        let bar = progressBarSteps
        guard let idx = bar.firstIndex(of: currentStep), bar.count > 1 else { return 0 }
        return Double(idx) / Double(bar.count - 1) * 100
    }

    var totalExpenses: Decimal {
        totalCharges + totalSavings
    }

    var totalCustomIncome: Decimal {
        customTransactions
            .filter { $0.type == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }
    }

    var availableToSpend: Decimal {
        (monthlyIncome ?? 0) + totalCustomIncome - totalExpenses
    }

    // MARK: - Navigation

    func canProceed(from step: OnboardingStep) -> Bool {
        switch step {
        case .welcome:
            return true
        case .firstName:
            return isFirstNameValid
        case .income:
            return isIncomeValid
        case .charges:
            return true
        case .savings:
            return true
        case .budgetPreview:
            return true
        case .registration:
            return canSubmitRegistration
        }
    }

    func nextStep() {
        // Edit round-trip: return to preview instead of advancing sequentially
        if let returnStep = editReturnStep {
            editReturnStep = nil
            isMovingForward = true
            withAnimation(PulpeAnimations.stepTransition) {
                currentStep = returnStep
            }
            saveToStorage()
            return
        }

        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep) else { return }

        // BudgetPreview is the finale — trigger completion instead of advancing
        guard let next = nextVisibleStep(after: currentIndex) else {
            if currentStep == .budgetPreview {
                readyToComplete = true
            }
            return
        }

        // Track onboarding step completions (skip welcome — it has its own event)
        if currentStep != .welcome {
            AnalyticsService.shared.capture(.onboardingStepCompleted, properties: ["step": currentStep.analyticsName])
        }

        isMovingForward = true
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = next
        }
        saveToStorage()
    }

    /// True when the previous visible step is welcome — tapping back triggers exit confirmation.
    var wouldExitOnBack: Bool {
        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep) else { return false }
        return previousVisibleStep(before: currentIndex) == .welcome
    }

    func previousStep() {
        // Edit round-trip: cancel edit and return to preview
        if let returnStep = editReturnStep {
            editReturnStep = nil
            isMovingForward = true
            withAnimation(PulpeAnimations.stepTransition) {
                currentStep = returnStep
            }
            saveToStorage()
            return
        }

        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep),
              let prev = previousVisibleStep(before: currentIndex) else {
            return
        }

        isMovingForward = false
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = prev
        }
        saveToStorage()
    }

    /// Advance to the first visible step after welcome, without animation.
    /// Used during init when entering with a pre-authenticated social user.
    func startAfterWelcome() {
        guard let next = nextVisibleStep(after: 0) else { return }
        currentStep = next
    }

    /// Navigate to a specific step for editing, with a return bookmark.
    /// Both nextStep() and previousStep() will return to `returnTo` instead of navigating sequentially.
    func jumpToStepForEdit(_ step: OnboardingStep, returnTo: OnboardingStep = .budgetPreview) {
        editReturnStep = returnTo
        isMovingForward = false
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = step
        }
    }

    // MARK: - Template Creation

    func createTemplateData() -> BudgetTemplateCreateFromOnboarding {
        BudgetTemplateCreateFromOnboarding(
            name: "Mois Standard",
            description: "Créé pendant l'inscription",
            isDefault: true,
            monthlyIncome: monthlyIncome,
            housingCosts: housingCosts,
            healthInsurance: healthInsurance,
            leasingCredit: leasingCredit,
            phonePlan: phonePlan,
            transportCosts: transportCosts,
            customTransactions: customTransactions
        )
    }

    // MARK: - Running Totals

    /// Fixed charges (housing, insurance, etc.) + custom expense-type transactions
    var totalCharges: Decimal {
        let housing: Decimal = housingCosts ?? 0
        let health: Decimal = healthInsurance ?? 0
        let phone: Decimal = phonePlan ?? 0
        let transport: Decimal = transportCosts ?? 0
        let leasing: Decimal = leasingCredit ?? 0
        let customExpenses = customTransactions
            .filter { $0.type == .expense }
            .reduce(Decimal.zero) { $0 + $1.amount }
        return housing + health + phone + transport + leasing + customExpenses
    }

    var totalSavings: Decimal {
        customTransactions
            .filter { $0.type == .saving }
            .reduce(Decimal.zero) { $0 + $1.amount }
    }

    var totalIncome: Decimal {
        (monthlyIncome ?? 0) + totalCustomIncome
    }

    // MARK: - Suggestions

    static let chargeSuggestions: [OnboardingTransaction] = [
        OnboardingTransaction(amount: 600, type: .expense, name: "Courses / alimentation"),
        OnboardingTransaction(amount: 150, type: .expense, name: "Restaurants & sorties"),
        OnboardingTransaction(amount: 100, type: .expense, name: "Loisirs & sport"),
    ]

    static let savingSuggestions: [OnboardingTransaction] = [
        OnboardingTransaction(amount: 500, type: .saving, name: "Épargne"),
        OnboardingTransaction(amount: 587, type: .saving, name: "3ème pilier"),
    ]

    static let suggestions: [OnboardingTransaction] = chargeSuggestions + savingSuggestions

    func isSuggestionSelected(_ suggestion: OnboardingTransaction) -> Bool {
        customTransactions.contains {
            $0.name == suggestion.name && $0.type == suggestion.type && $0.amount == suggestion.amount
        }
    }

    func toggleSuggestion(_ suggestion: OnboardingTransaction) {
        if let index = customTransactions.firstIndex(where: {
            $0.name == suggestion.name && $0.type == suggestion.type && $0.amount == suggestion.amount
        }) {
            customTransactions.remove(at: index)
        } else {
            guard customTransactions.count < 50 else { return }
            customTransactions.append(suggestion)
        }
    }

    // MARK: - Custom Transactions

    func addCustomTransaction(_ tx: OnboardingTransaction) {
        guard customTransactions.count < 50 else { return }
        customTransactions.append(tx)
    }

    func removeCustomTransaction(at index: Int) {
        customTransactions.remove(at: index)
    }

    func updateCustomTransactionAmount(at index: Int, amount: Decimal) {
        guard customTransactions.indices.contains(index) else { return }
        customTransactions[index].amount = amount
    }

    /// Replace a custom transaction by ID with updated data
    func replaceCustomTransaction(id: UUID, with tx: OnboardingTransaction) {
        guard let index = customTransactions.firstIndex(where: { $0.id == id }) else { return }
        customTransactions[index] = tx
    }
}

// MARK: - Persistence

extension OnboardingState {
    func saveToStorage() {
        let storedTx = customTransactions.map {
            OnboardingStorageData.StoredTransaction(
                amount: $0.amount,
                type: $0.type.rawValue,
                name: $0.name,
                description: $0.description,
                expenseType: $0.expenseType.rawValue,
                isRecurring: $0.isRecurring
            )
        }
        let data = OnboardingStorageData(
            firstName: firstName,
            currentStep: currentStep.rawValue,
            customTransactions: storedTx.isEmpty ? nil : storedTx,
            monthlyIncome: monthlyIncome,
            housingCosts: housingCosts,
            healthInsurance: healthInsurance,
            phonePlan: phonePlan,
            transportCosts: transportCosts,
            leasingCredit: leasingCredit,
            isEmailRegistered: !isSocialAuth && isAuthenticated ? true : nil
        )

        if let encoded = try? JSONEncoder().encode(data) {
            UserDefaults.standard.set(encoded, forKey: Self.storageKey)
        }
    }

    func loadFromStorage() {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let decoded = try? JSONDecoder().decode(OnboardingStorageData.self, from: data) else {
            return
        }

        firstName = decoded.firstName

        if let step = OnboardingStep(rawValue: decoded.currentStep) {
            currentStep = step
        }

        monthlyIncome = decoded.monthlyIncome
        housingCosts = decoded.housingCosts
        healthInsurance = decoded.healthInsurance
        phonePlan = decoded.phonePlan
        transportCosts = decoded.transportCosts
        leasingCredit = decoded.leasingCredit
        wasEmailRegistered = decoded.isEmailRegistered ?? false

        if let storedTx = decoded.customTransactions {
            customTransactions = storedTx.compactMap { stored in
                guard let type = TransactionKind(rawValue: stored.type),
                      let expenseType = TransactionRecurrence(rawValue: stored.expenseType) else {
                    return nil
                }
                return OnboardingTransaction(
                    amount: stored.amount,
                    type: type,
                    name: stored.name,
                    description: stored.description,
                    expenseType: expenseType,
                    isRecurring: stored.isRecurring
                )
            }
        }
    }

    func clearStorage() {
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    static func clearPersistedData() {
        UserDefaults.standard.removeObject(forKey: storageKey)
    }
}

// MARK: - Storage Data

private struct OnboardingStorageData: Codable {
    let firstName: String
    let currentStep: String
    let customTransactions: [StoredTransaction]?
    let monthlyIncome: Decimal?
    let housingCosts: Decimal?
    let healthInsurance: Decimal?
    let phonePlan: Decimal?
    let transportCosts: Decimal?
    let leasingCredit: Decimal?
    let isEmailRegistered: Bool?

    struct StoredTransaction: Codable {
        let amount: Decimal
        let type: String
        let name: String
        let description: String?
        let expenseType: String
        let isRecurring: Bool
    }
}
