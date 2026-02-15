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
    var password: String = ""
    var passwordConfirmation: String = ""
    var acceptTerms: Bool = false

    // MARK: - UI State

    var currentStep: OnboardingStep = .welcome
    var isLoading: Bool = false
    var error: Error?
    var isMovingForward: Bool = true
    var signupProgress: SignupProgress = .notStarted
    var createdTemplateId: String?

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
        let pattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
        return email.wholeMatch(of: pattern) != nil
    }

    var isPasswordValid: Bool {
        password.count >= 8 &&
        password.contains { $0.isUppercase } &&
        password.contains { $0.isNumber }
    }

    var isPasswordConfirmed: Bool {
        !passwordConfirmation.isEmpty && password == passwordConfirmation
    }

    var canSubmitRegistration: Bool {
        isFirstNameValid && isIncomeValid && isEmailValid && isPasswordValid && isPasswordConfirmed && acceptTerms && !isLoading
    }

    var progressPercentage: Double {
        let totalSteps = OnboardingStep.allCases.count - 1 // Exclude welcome
        guard let stepIndex = OnboardingStep.allCases.firstIndex(of: currentStep) else { return 0 }
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
        isMovingForward = true
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = OnboardingStep.allCases[currentIndex + 1]
        }
        saveToStorage()
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
            monthlyIncome: monthlyIncome,
            housingCosts: housingCosts,
            healthInsurance: healthInsurance,
            phonePlan: phonePlan,
            transportCosts: transportCosts,
            leasingCredit: leasingCredit,
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
        monthlyIncome = decoded.monthlyIncome
        housingCosts = decoded.housingCosts
        healthInsurance = decoded.healthInsurance
        phonePlan = decoded.phonePlan
        transportCosts = decoded.transportCosts
        leasingCredit = decoded.leasingCredit

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

    var title: String {
        switch self {
        case .welcome: "Bienvenue"
        case .personalInfo: "Qui es-tu ?"
        case .expenses: "Tes charges fixes"
        case .budgetPreview: "Ton budget"
        case .registration: "Dernière étape"
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: "Reprends le contrôle de tes finances"
        case .personalInfo: "On fait connaissance"
        case .expenses: "Renseigne ce que tu connais — le reste peut attendre"
        case .budgetPreview: "Voici ce que ça donne"
        case .registration: "On y est presque !"
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

// MARK: - Signup Progress

enum SignupProgress {
    case notStarted
    case userCreated
    case templateCreated(templateId: String)
}

// MARK: - Storage Data

private struct OnboardingStorageData: Codable {
    let firstName: String
    let monthlyIncome: Decimal?
    let housingCosts: Decimal?
    let healthInsurance: Decimal?
    let phonePlan: Decimal?
    let transportCosts: Decimal?
    let leasingCredit: Decimal?
    let currentStep: String
}
