import OSLog

/// Handles post-PIN-setup onboarding: creates a budget template and initial budget
/// from onboarding data collected during the signup flow.
@MainActor
final class OnboardingBootstrapper {
    // MARK: - State
    private(set) var pendingOnboardingData: BudgetTemplateCreateFromOnboarding?
    /// Auth method captured at the moment the user completes onboarding. Used to tag
    /// `first_budget_created` so PostHog funnels can compare conversion across providers.
    /// Falls back to `"email"` when the caller didn't supply one — matches the existing
    /// `OnboardingState.authMethodProperty` convention.
    private var pendingSignupMethod: String?

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

    /// Legacy overload — kept so existing call sites (and tests) that set
    /// `pendingOnboardingData` through the `AppState` computed setter compile.
    /// The new `completeOnboarding` flow uses `setPendingData(_:signupMethod:)`.
    func setPendingData(_ data: BudgetTemplateCreateFromOnboarding?) {
        pendingOnboardingData = data
        if data == nil { pendingSignupMethod = nil }
    }

    func setPendingData(_ data: BudgetTemplateCreateFromOnboarding?, signupMethod: String?) {
        pendingOnboardingData = data
        pendingSignupMethod = data == nil ? nil : signupMethod
    }

    func clearPendingData() {
        pendingOnboardingData = nil
        pendingSignupMethod = nil
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

            let signupMethod = pendingSignupMethod ?? "email"
            let customCount = onboardingData.customTransactions.count
            pendingOnboardingData = nil
            pendingSignupMethod = nil

            AnalyticsService.shared.capture(.firstBudgetCreated, properties: [
                "signup_method": signupMethod,
                "has_pay_day": false,
                "charges_count": [
                    onboardingData.housingCosts,
                    onboardingData.healthInsurance,
                    onboardingData.phonePlan,
                    onboardingData.transportCosts,
                    onboardingData.leasingCredit
                ].compactMap { $0 }.count,
                "custom_transactions_count": customCount
            ])
            return true
        } catch {
            Logger.auth.error("OnboardingBootstrapper: failed to create template/budget - \(error)")
            toastManager.show("Erreur lors de la création du budget", type: .error)
            return false
        }
    }
}
