import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    /// The model behind the budget. `nil` (or a closed month) turns "Chaque mois" off.
    let templateId: String?
    /// The month as it stands, to judge what the new prévision does to the disponible.
    let ledger: MonthLedger?
    let onAdd: (BudgetLine) -> Void
    /// PUL-292: routes the CTA to a prefilled withdrawal instead of creating plain income.
    let onRequestSavingsWithdrawal: ((SavingsWithdrawalPrefill) -> Void)?
    /// Called once an every-month prévision is written into the model, so the month reloads.
    let onTemplateLineAdded: (() -> Void)?

    @Environment(\.dismiss) var dismiss
    @Environment(ToastManager.self) var toastManager
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(BudgetListStore.self) var budgetListStore
    @Environment(FeatureFlagsStore.self) var featureFlags
    @Environment(AssetStore.self) var assetStore
    @State var name = ""
    @State var amount: Decimal?
    @State var kind: TransactionKind = .expense
    @State var savingsGoalId: String?
    @State var assetId: String?
    @State var isLoading = false
    @State var error: Error?
    @FocusState var focusedField: AmountDescriptionField?
    @State var amountText = ""
    @State var submitSuccessTrigger = false
    @State var inputCurrency: SupportedCurrency = .chf
    @State var mode: BudgetLineCreationMode = .once
    @State var spreadMonthCount = 6
    /// Income-only, `.regular` by default. `.repayNextMonth` reroutes the CTA to
    /// the "piocher dans son épargne" preview (PUL-292); `.savingsGoal` plans a
    /// withdrawal from the picked goal (PUL-329 v2).
    @State var incomeOrigin: IncomeOrigin = .regular
    /// The goal a `.savingsGoal` income is announced to be drawn FROM — the
    /// opposite direction of `savingsGoalId`, which pays INTO one.
    @State var sourceSavingsGoalId: String?
    /// The typed amount in the ACCOUNT currency — what the projection has to be
    /// judged against (RG-009). `nil` while the rate is in flight or unavailable;
    /// the preview then omits the "après" rather than blocking the planification,
    /// which the server never validates against a rate anyway.
    @State var convertedAmount: Decimal?
    @State var spreadCalculator: SpreadCalculator
    /// Idempotency key for the spread create (PUL-17), minted ONCE per sheet
    /// presentation and replayed on every submit retry so a double-tap replays
    /// the group instead of duplicating it. Lowercased to mirror `crypto.randomUUID()`.
    @State var spreadGroupId = UUID().uuidString.lowercased()

    let anchorMonth: Int
    let anchorYear: Int
    let dependencies: AddBudgetLineDependencies
    let conversionService = CurrencyConversionService.shared
    init(
        budgetId: String,
        anchorMonth: Int,
        anchorYear: Int,
        templateId: String? = nil,
        initialKind: TransactionKind = .expense,
        ledger: MonthLedger? = nil,
        dependencies: AddBudgetLineDependencies = .live,
        onRequestSavingsWithdrawal: ((SavingsWithdrawalPrefill) -> Void)? = nil,
        onTemplateLineAdded: (() -> Void)? = nil,
        onAdd: @escaping (BudgetLine) -> Void
    ) {
        self.budgetId = budgetId
        self.templateId = templateId
        self.ledger = ledger
        self.onTemplateLineAdded = onTemplateLineAdded
        self._kind = State(initialValue: initialKind)
        self.anchorMonth = anchorMonth
        self.anchorYear = anchorYear
        self.dependencies = dependencies
        self.onRequestSavingsWithdrawal = onRequestSavingsWithdrawal
        self.onAdd = onAdd
        // Anchor the spread on the opened budget's period (PUL-17).
        self._spreadCalculator = State(initialValue: SpreadCalculator(
            anchorMonth: anchorMonth,
            anchorYear: anchorYear
        ))
    }

    var isSpreadMode: Bool { mode == .spread }

    static func showsSavingsGoalPicker(kind: TransactionKind) -> Bool { kind == .saving }

    /// The period the goal link has to survive. A spread submits one line per selected
    /// month and `enforce_savings_goal_line_link` rejects the WHOLE fan-out as soon as
    /// a single one lands past the goal's deadline — so the LAST month binds, not the
    /// anchor the sheet was opened on. `selectedMonths` is ascending, hence `.last`.
    /// Pass an empty array outside spread mode: only the anchor is written then.
    static func savingsGoalPeriod(
        spreadMonths: [SpreadMonth],
        anchorMonth: Int,
        anchorYear: Int
    ) -> BudgetPeriod {
        guard let last = spreadMonths.last else {
            return BudgetPeriod(month: anchorMonth, year: anchorYear)
        }
        return BudgetPeriod(month: last.month, year: last.year)
    }

    var canSubmit: Bool {
        guard (amount ?? 0) > 0, !isLoading else { return false }
        // Withdrawal reroute: the source name is optional (defaults to "Mon épargne").
        if isSavingsWithdrawalMode { return true }
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        // An announcement without a goal names no pot to draw from.
        if isPlannedWithdrawalMode, sourceSavingsGoalId == nil { return false }
        if kind == .income, incomeOrigin == .asset, assetId == nil { return false }
        if mode == .everyMonth, !offersEveryMonth { return false }
        return isSpreadMode ? spreadCalculator.isValid : true
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var validationHint: String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return AppLocale.string("Ajoute un montant") }
        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            return AppLocale.string("Ajoute une description")
        }
        if isPlannedWithdrawalMode { return AppLocale.string("Choisis l'objectif à retirer") }
        return nil
    }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Nouvelle prévision"),
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            KindToggle(selection: $kind)

            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: amountCaption,
                currency: inputCurrency
            )

            FormCard { descriptionField }

            whenSection

            impactBlock

            detailsCard

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear { inputCurrency = userSettingsStore.currency }
        .onChange(of: kind) { _, newKind in
            // Income can't be spread; only savings carry a goal; origin is income-only.
            if newKind == .income, mode == .spread { mode = .once }
            if newKind != .saving { savingsGoalId = nil }
            assetId = nil
            if newKind != .income { incomeOrigin = .regular }
            resetIncompatibleOriginState()
        }
        .onChange(of: incomeOrigin) { _, _ in resetIncompatibleOriginState() }
        .task { await Self.loadAssets(flagOn: featureFlags.isNetWorthEnabled, store: assetStore) }
        .onChange(of: spreadMonthCount, initial: true) { _, count in
            spreadCalculator.setEnd(SpreadMonth.from(ordinal: spreadCalculator.start.ordinal + count - 1))
        }
        .task(id: PlannedWithdrawalConversionKey(amount: amount, currency: inputCurrency)) {
            await refreshConvertedAmount()
        }
    }

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: AppLocale.string("Description"),
            accessibilityLabel: AppLocale.string("Description de la prévision"),
            focusBinding: $focusedField,
            field: .description,
            style: .row,
            onSubmit: {
                guard canSubmit else { return }
                Task { await submit() }
            }
        )
    }
}

#Preview {
    AddBudgetLineSheet(budgetId: "test", anchorMonth: 6, anchorYear: 2026) { line in
        print("Added: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(BudgetListStore())
    .environment(SavingsGoalStore())
    .environment(AssetStore())
    .environment(FeatureFlagsStore())
    .environment(TagStore())
}
