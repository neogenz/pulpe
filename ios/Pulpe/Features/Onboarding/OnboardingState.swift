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
    var acceptTerms: Bool = false

    // MARK: - Social Auth

    var socialUser: UserInfo?
    var readyForSocialCompletion: Bool = false
    var isSocialSignup: Bool { socialUser != nil }

    /// Whether the name field should be displayed during onboarding.
    /// Hidden only when a social provider already supplied a valid name.
    var shouldShowNameField: Bool {
        !isSocialSignup || !isFirstNameValid
    }

    /// Configures state for a social signup user.
    /// Pre-fills firstName from provider metadata and clears persisted step
    /// so cold-start after app kill resets to welcome.
    func configureSocialUser(_ user: UserInfo) {
        socialUser = user
        if let name = user.firstName, !name.isEmpty {
            firstName = name
        }
        clearStorage()
    }

    // MARK: - UI State

    var currentStep: OnboardingStep = .welcome
    var isLoading: Bool = false
    var error: Error?
    var isMovingForward: Bool = true
    var hasCompleted: Bool = false
    var hasAbandoned: Bool = false
    var isSubmitting: Bool = false

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
        isFirstNameValid && isIncomeValid && isEmailValid && acceptTerms && !isLoading
    }

    var progressPercentage: Double {
        // Exclude welcome; also exclude registration for social users
        let totalSteps = OnboardingStep.allCases.count - (isSocialSignup ? 2 : 1)
        guard totalSteps > 0,
              let stepIndex = OnboardingStep.allCases.firstIndex(of: currentStep) else { return 0 }
        let currentIndex = max(0, stepIndex - 1)
        return Double(currentIndex) / Double(totalSteps) * 100
    }

    var totalExpenses: Decimal {
        let housing: Decimal = housingCosts ?? 0
        let health: Decimal = healthInsurance ?? 0
        let phone: Decimal = phonePlan ?? 0
        let transport: Decimal = transportCosts ?? 0
        let leasing: Decimal = leasingCredit ?? 0
        let customOutflows = customTransactions
            .filter { $0.type.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }
        return housing + health + phone + transport + leasing + customOutflows
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
        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep),
              currentIndex < OnboardingStep.allCases.count - 1 else {
            return
        }
        // Track onboarding step completions (skip welcome — it has its own event)
        if currentStep != .welcome {
            AnalyticsService.shared.capture(.onboardingStepCompleted, properties: ["step": currentStep.analyticsName])
        }

        let nextStep = OnboardingStep.allCases[currentIndex + 1]

        // Social users skip registration — trigger completion from budgetPreview
        if nextStep == .registration && isSocialSignup {
            readyForSocialCompletion = true
            return
        }

        isMovingForward = true
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = nextStep
        }
        saveToStorage()
    }

    var wouldExitOnBack: Bool {
        currentStep == .personalInfo
    }

    func previousStep() {
        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep),
              currentIndex > 0 else {
            return
        }
        isMovingForward = false
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = OnboardingStep.allCases[currentIndex - 1]
        }
        saveToStorage()
    }

    // MARK: - Persistence

    func saveToStorage() {
        let data = OnboardingStorageData(
            firstName: firstName,
            currentStep: currentStep.rawValue
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
    }

    func clearStorage() {
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    static func clearPersistedData() {
        UserDefaults.standard.removeObject(forKey: storageKey)
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

    var totalCharges: Decimal {
        let housing: Decimal = housingCosts ?? 0
        let health: Decimal = healthInsurance ?? 0
        let phone: Decimal = phonePlan ?? 0
        let transport: Decimal = transportCosts ?? 0
        let leasing: Decimal = leasingCredit ?? 0
        let hardcoded = housing + health + phone + transport + leasing
        let customExpenses = customTransactions
            .filter { $0.type == .expense }
            .reduce(Decimal.zero) { $0 + $1.amount }
        return hardcoded + customExpenses
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

    static var suggestions: [OnboardingTransaction] {
        chargeSuggestions + savingSuggestions
    }

    func isSuggestionSelected(_ suggestion: OnboardingTransaction) -> Bool {
        customTransactions.contains { $0.name == suggestion.name && $0.type == suggestion.type }
    }

    func toggleSuggestion(_ suggestion: OnboardingTransaction) {
        if let index = customTransactions.firstIndex(where: {
            $0.name == suggestion.name && $0.type == suggestion.type
        }) {
            customTransactions.remove(at: index)
        } else {
            customTransactions.append(suggestion)
        }
    }

    // MARK: - Custom Transactions

    func addCustomTransaction(_ tx: OnboardingTransaction) {
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

// MARK: - Step Enum

enum OnboardingStep: String, CaseIterable, Identifiable {
    case welcome
    case firstName
    case income
    case charges
    case savings
    case budgetPreview
    case registration

    var id: String { rawValue }

    var analyticsName: String {
        switch self {
        case .welcome: "welcome"
        case .firstName: "first_name"
        case .income: "income"
        case .charges: "charges"
        case .savings: "savings"
        case .budgetPreview: "budget_preview"
        case .registration: "registration"
        }
    }

    var title: String {
        switch self {
        case .welcome: "Bienvenue"
        case .firstName: "Comment tu t'appelles ?"
        case .income: "Tes revenus"
        case .charges: "Tes charges fixes"
        case .savings: "Ton épargne"
        case .budgetPreview: "Ton budget"
        case .registration: "Crée ton compte"
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: "Reprends le contrôle de tes finances"
        case .firstName: "Juste ton prénom"
        case .income: "Ton salaire et tes autres revenus"
        case .charges: "Renseigne ce que tu connais — le reste peut attendre"
        case .savings: "Ce que tu mets de côté chaque mois"
        case .budgetPreview: "Voici ce que ça donne"
        case .registration: "Pour sauvegarder ton budget"
        }
    }

    /// Alternative title when context changes (e.g. social signup skips name field)
    var socialTitle: String? {
        switch self {
        case .personalInfo: "Ton revenu"
        default: nil
        }
    }

    /// Alternative subtitle for social signup context
    var socialSubtitle: String? {
        switch self {
        case .personalInfo: "Indique ton revenu mensuel"
        default: nil
        }
    }

    var isOptional: Bool {
        switch self {
        case .charges, .savings:
            return true
        default:
            return false
        }
    }

    var showProgressBar: Bool {
        self != .welcome
    }

    var iconName: String {
        switch self {
        case .welcome: "sparkles"
        case .firstName: "person.circle.fill"
        case .income: "arrow.down.circle.fill"
        case .charges: "house.fill"
        case .savings: "building.columns"
        case .budgetPreview: "chart.pie.fill"
        case .registration: "checkmark.seal.fill"
        }
    }

    var iconColor: Color {
        switch self {
        case .welcome: .pulpePrimary
        case .firstName: .pulpePrimary
        case .income: .financialIncome
        case .charges: .stepHousing
        case .savings: .financialSavings
        case .budgetPreview: .pulpePrimary
        case .registration: .pulpePrimary
        }
    }
}

// MARK: - Storage Data

private struct OnboardingStorageData: Codable {
    let firstName: String
    let currentStep: String
}
