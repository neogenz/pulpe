import OSLog

/// Handles post-PIN-setup onboarding: creates a budget template and initial budget
/// from onboarding data collected during the signup flow.
@MainActor
final class OnboardingBootstrapper {
    // MARK: - State
    private(set) var pendingOnboardingData: BudgetTemplateCreateFromOnboarding?

    // MARK: - Dependencies

    private let createTemplate: (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate
    private let createBudget: (BudgetCreate) async throws -> Budget
    private let toastManager: ToastManager

    init(
        createTemplate: @escaping (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate,
        createBudget: @escaping (BudgetCreate) async throws -> Budget,
        toastManager: ToastManager
    ) {
        self.createTemplate = createTemplate
        self.createBudget = createBudget
        self.toastManager = toastManager
    }

    // MARK: - Public API

    func setPendingData(_ data: BudgetTemplateCreateFromOnboarding?) {
        pendingOnboardingData = data
    }

    func clearPendingData() {
        pendingOnboardingData = nil
    }

    /// Creates template + budget from pending onboarding data if present.
    /// No-op if no pending data. Consumes the data on success; retains it on error for retry.
    /// - Returns: `true` if no pending data or bootstrap succeeded, `false` on error.
    @discardableResult
    func bootstrapIfNeeded() async -> Bool {
        guard let onboardingData = pendingOnboardingData else { return true }

        do {
            let template = try await createTemplate(onboardingData)

            let now = Date()
            let budgetData = BudgetCreate(
                month: now.month,
                year: now.year,
                description: now.monthYearFormatted,
                templateId: template.id
            )
            _ = try await createBudget(budgetData)

            pendingOnboardingData = nil
            AnalyticsService.shared.capture(.firstBudgetCreated, properties: [
                "has_pay_day": false,
                "charges_count": [
                    onboardingData.housingCosts,
                    onboardingData.healthInsurance,
                    onboardingData.phonePlan,
                    onboardingData.transportCosts,
                    onboardingData.leasingCredit
                ].compactMap { $0 }.count
            ])
            return true
        } catch {
            Logger.auth.error("OnboardingBootstrapper: failed to create template/budget - \(error)")
            toastManager.show("Erreur lors de la création du budget", type: .error)
            return false
        }
    }
}
