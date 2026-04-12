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

    /// True when the social provider supplied a valid first name at auth time.
    /// Set once in `configureSocialUser` so the visible step count doesn't shift
    /// while the user is interacting with the form.
    private(set) var socialProvidedName: Bool = false

    /// Triggers `finishOnboarding` from BudgetPreview (the finale) for all auth paths.
    var readyToComplete: Bool = false

    /// Set when email registration was persisted — used for cold-start session recovery.
    /// Not `private(set)` because `OnboardingState+Persistence.swift` restores it from disk.
    var wasEmailRegistered: Bool = false

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

    /// UserDefaults key for the persisted onboarding draft.
    /// Internal (not private) so `OnboardingState+Persistence.swift` can reference it.
    static let storageKey = "pulpe-onboarding-data"

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

    /// Whether the step is shown in the progress bar (stable throughout the flow).
    /// Email users always see registration in their count — it's just marked as completed
    /// after they sign up, instead of vanishing and shifting the total.
    /// Social users never see registration at all (they authenticated on WelcomeStep).
    private func isStepInProgressBar(_ step: OnboardingStep) -> Bool {
        switch step {
        case .welcome:
            return false
        case .firstName:
            return !(isSocialAuth && socialProvidedName)
        case .registration:
            return !isSocialAuth
        case .income, .charges, .savings, .budgetPreview:
            return true
        }
    }

    /// Whether the step should be visited during navigation.
    /// Stricter than `isStepInProgressBar`: authenticated users skip registration
    /// even if it's still counted in the progress bar.
    private func isStepNavigable(_ step: OnboardingStep) -> Bool {
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
        OnboardingStep.allCases.filter(isStepInProgressBar)
    }

    private func nextVisibleStep(after index: Int) -> OnboardingStep? {
        let allCases = OnboardingStep.allCases
        guard index + 1 < allCases.count else { return nil }
        return allCases[(index + 1)...].first { isStepNavigable($0) }
    }

    private func previousVisibleStep(before index: Int) -> OnboardingStep? {
        guard index > 0 else { return nil }
        return OnboardingStep.allCases[..<index].reversed().first { isStepNavigable($0) }
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

        // BudgetPreview is the finale — fire its completion event then trigger readyToComplete.
        guard let next = nextVisibleStep(after: currentIndex) else {
            if currentStep == .budgetPreview {
                captureStepCompleted(currentStep)
                readyToComplete = true
            }
            return
        }

        // Track onboarding step completions (skip welcome — it has its own event)
        if currentStep != .welcome {
            captureStepCompleted(currentStep)
        }

        isMovingForward = true
        withAnimation(PulpeAnimations.stepTransition) {
            currentStep = next
        }
        saveToStorage()
    }

    /// Fire the `onboarding_step_completed` event for a given step.
    /// Enriched with `step_index` (1-based), `step_total` (total visible for this path), and
    /// `auth_method` so PostHog funnels are resilient to future step reordering.
    private func captureStepCompleted(_ step: OnboardingStep) {
        let bar = progressBarSteps
        let index = (bar.firstIndex(of: step).map { $0 + 1 }) ?? 0
        AnalyticsService.shared.capture(
            .onboardingStepCompleted,
            properties: [
                "step": step.analyticsName,
                "step_index": index,
                "step_total": bar.count,
                "auth_method": authMethodProperty
            ]
        )
    }

    /// Stable string describing the auth method for analytics properties.
    /// `unknown` covers the pre-auth window (user is on firstName but hasn't signed up yet).
    var authMethodProperty: String {
        if !isAuthenticated { return "unknown" }
        return isSocialAuth ? "social" : "email"
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

// Persistence is implemented in OnboardingState+Persistence.swift
