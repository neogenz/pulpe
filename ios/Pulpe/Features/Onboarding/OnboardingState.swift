import Foundation
import SwiftUI

/// State for the onboarding flow
@Observable
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
    var isUserCreated: Bool = false

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
        email.contains("@") && email.contains(".")
    }

    var isPasswordValid: Bool {
        password.count >= 8
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

    // MARK: - Navigation

    func canProceed(from step: OnboardingStep) -> Bool {
        switch step {
        case .welcome:
            return true
        case .personalInfo:
            return isFirstNameValid
        case .income:
            return isIncomeValid
        case .housing, .healthInsurance, .phonePlan, .transport, .leasingCredit:
            return true // Optional steps
        case .registration:
            return canSubmitRegistration
        }
    }

    func nextStep() {
        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep),
              currentIndex < OnboardingStep.allCases.count - 1 else {
            return
        }
        currentStep = OnboardingStep.allCases[currentIndex + 1]
        saveToStorage()
    }

    func previousStep() {
        guard let currentIndex = OnboardingStep.allCases.firstIndex(of: currentStep),
              currentIndex > 0 else {
            return
        }
        currentStep = OnboardingStep.allCases[currentIndex - 1]
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
    case income
    case housing
    case healthInsurance
    case phonePlan
    case transport
    case leasingCredit
    case registration

    var id: String { rawValue }

    var title: String {
        switch self {
        case .welcome: "Bienvenue"
        case .personalInfo: "Qui êtes-vous ?"
        case .income: "Vos revenus"
        case .housing: "Logement"
        case .healthInsurance: "Assurance maladie"
        case .phonePlan: "Téléphone"
        case .transport: "Transport"
        case .leasingCredit: "Leasing / Crédit"
        case .registration: "Inscription"
        }
    }

    var subtitle: String {
        switch self {
        case .welcome: "Gérez votre budget simplement"
        case .personalInfo: "Nous aimerions mieux vous connaître"
        case .income: "Combien gagnez-vous par mois ?"
        case .housing: "Quel est votre loyer mensuel ?"
        case .healthInsurance: "Combien payez-vous par mois ?"
        case .phonePlan: "Quel est le coût de votre forfait ?"
        case .transport: "Abonnement, essence, etc."
        case .leasingCredit: "Mensualités de leasing ou crédit"
        case .registration: "Dernière étape !"
        }
    }

    var isOptional: Bool {
        switch self {
        case .housing, .healthInsurance, .phonePlan, .transport, .leasingCredit:
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
        case .income: "banknote.fill"
        case .housing: "house.fill"
        case .healthInsurance: "cross.circle.fill"
        case .phonePlan: "iphone"
        case .transport: "car.fill"
        case .leasingCredit: "creditcard.fill"
        case .registration: "checkmark.seal.fill"
        }
    }

    var iconColor: Color {
        switch self {
        case .welcome: .pulpePrimary
        case .personalInfo: .pulpePrimary
        case .income: .stepIncome
        case .housing: .stepHousing
        case .healthInsurance: .stepHealth
        case .phonePlan: .stepPhone
        case .transport: .stepTransport
        case .leasingCredit: .stepCredit
        case .registration: .pulpePrimary
        }
    }
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
