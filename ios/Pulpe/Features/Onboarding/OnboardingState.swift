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
        return housing + health + phone + transport + leasing
    }

    var availableToSpend: Decimal {
        (monthlyIncome ?? 0) - totalExpenses
    }

    // MARK: - Navigation

    func canProceed(from step: OnboardingStep) -> Bool {
        switch step {
        case .welcome:
            return true
        case .personalInfo:
            return isFirstNameValid && isIncomeValid
        case .expenses:
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
            transportCosts: transportCosts
        )
    }
}

// MARK: - Step Enum

enum OnboardingStep: String, CaseIterable, Identifiable {
    case welcome
    case personalInfo
    case expenses
    case budgetPreview
    case registration

    var id: String { rawValue }

    var analyticsName: String {
        switch self {
        case .welcome: "welcome"
        case .personalInfo: "personal_info"
        case .expenses: "expenses"
        case .budgetPreview: "budget_preview"
        case .registration: "registration"
        }
    }

    var title: String {
        switch self {
        case .welcome: "Bienvenue"
        case .personalInfo: "Qui es-tu ?"
        case .expenses: "Tes charges fixes"
        case .budgetPreview: "Ton budget"
        case .registration: "Crée ton compte"
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: "Reprends le contrôle de tes finances"
        case .personalInfo: "Juste ton prénom et tes revenus"
        case .expenses: "Renseigne ce que tu connais — le reste peut attendre"
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
        case .expenses:
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
        case .personalInfo: "person.circle.fill"
        case .expenses: "house.fill"
        case .budgetPreview: "chart.pie.fill"
        case .registration: "checkmark.seal.fill"
        }
    }

    var iconColor: Color {
        switch self {
        case .welcome: .pulpePrimary
        case .personalInfo: .pulpePrimary
        case .expenses: .stepHousing
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
