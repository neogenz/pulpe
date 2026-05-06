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

    /// Currency picked during onboarding. Persisted to `user_settings` post-PIN-setup
    /// (see `bootstrapIfNeeded`) — calling the API earlier fails with `AUTH_CLIENT_KEY_MISSING`
    /// because the client key is derived from the PIN.
    private(set) var pendingCurrency: SupportedCurrency?

    // MARK: - Dependencies

    private let createTemplate: (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate
    private let createBudget: (BudgetCreate) async throws -> Budget
    private let toastManager: ToastManager
    /// Persists the pending currency to `user_settings`. Wired post-init from `PulpeApp`.
    /// See `bootstrapIfNeeded` for retry + failure-tolerance semantics.
    var persistCurrency: ((SupportedCurrency) async -> Bool)?

    private let retryDelays: [Duration]

    init(
        createTemplate: @escaping (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate,
        createBudget: @escaping (BudgetCreate) async throws -> Budget,
        toastManager: ToastManager,
        retryDelays: [Duration] = [.milliseconds(300), .milliseconds(1500)]
    ) {
        self.createTemplate = createTemplate
        self.createBudget = createBudget
        self.toastManager = toastManager
        self.retryDelays = retryDelays
    }

    // MARK: - Public API

    /// Legacy overload — kept so existing call sites (and tests) that set
    /// `pendingOnboardingData` through the `AppState` computed setter compile.
    /// The new `completeOnboarding` flow uses `setPendingData(_:signupMethod:currency:)`.
    func setPendingData(_ data: BudgetTemplateCreateFromOnboarding?) {
        pendingOnboardingData = data
        if data == nil {
            pendingSignupMethod = nil
            pendingCurrency = nil
        }
    }

    func setPendingData(_ data: BudgetTemplateCreateFromOnboarding?, signupMethod: String?) {
        pendingOnboardingData = data
        pendingSignupMethod = data == nil ? nil : signupMethod
        if data == nil { pendingCurrency = nil }
    }

    func setPendingData(
        _ data: BudgetTemplateCreateFromOnboarding?,
        signupMethod: String?,
        currency: SupportedCurrency?
    ) {
        pendingOnboardingData = data
        pendingSignupMethod = data == nil ? nil : signupMethod
        pendingCurrency = data == nil ? nil : currency
    }

    func clearPendingData() {
        pendingOnboardingData = nil
        pendingSignupMethod = nil
        pendingCurrency = nil
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

            // Persist currency AFTER template + budget. Runs post-PIN-setup so the
            // `X-Client-Key` header is available — calling earlier (during onboarding)
            // would 403 with `AUTH_CLIENT_KEY_MISSING`. A failure here logs + surfaces a
            // toast but does NOT fail the bootstrap: template + budget are already created,
            // and `completePinSetup` retries the whole bootstrap on `false` which would
            // duplicate them.
            await persistPendingCurrencyWithRetry()

            let signupMethod = pendingSignupMethod ?? "email"
            let customCount = onboardingData.customTransactions.count
            pendingOnboardingData = nil
            pendingSignupMethod = nil
            pendingCurrency = nil

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

    private func persistPendingCurrencyWithRetry() async {
        guard let currency = pendingCurrency else { return }
        guard let persistCurrency else {
            Logger.auth.fault("OnboardingBootstrapper: persistCurrency closure not wired")
            assertionFailure("persistCurrency closure must be wired before bootstrap runs")
            return
        }

        if await persistCurrency(currency) { return }

        for delay in retryDelays {
            if Task.isCancelled { return }
            try? await Task.sleep(for: delay)
            if Task.isCancelled { return }
            if await persistCurrency(currency) { return }
        }

        let totalAttempts = retryDelays.count + 1
        Logger.auth.error(
            "OnboardingBootstrapper: failed to persist currency after \(totalAttempts) attempts"
        )
        AnalyticsService.shared.capture(.currencyPersistFailed, properties: [
            "currency": currency.rawValue,
            "attempts": totalAttempts
        ])
        toastManager.show(
            "Devise non sauvegardée, réessaie depuis les paramètres",
            type: .error
        )
    }
}
