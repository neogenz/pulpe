import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void
    /// PUL-292: routes the CTA to a prefilled withdrawal instead of creating plain income.
    let onRequestSavingsWithdrawal: ((SavingsWithdrawalPrefill) -> Void)?

    @Environment(\.dismiss) var dismiss
    @Environment(ToastManager.self) var toastManager
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(BudgetListStore.self) var budgetListStore
    @State var name = ""
    @State var amount: Decimal?
    @State var kind: TransactionKind = .expense
    @State var savingsGoalId: String?
    @State var selectedTagIds: Set<String> = []
    @State var isChecked = false
    @State var isLoading = false
    @State var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText = ""
    @State var submitSuccessTrigger = false
    @State var inputCurrency: SupportedCurrency = .chf
    @State private var mode: BudgetLineCreationMode = .once
    @State var amountMode: SpreadAmountMode = .total
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
        dependencies: AddBudgetLineDependencies = .live,
        onRequestSavingsWithdrawal: ((SavingsWithdrawalPrefill) -> Void)? = nil,
        onAdd: @escaping (BudgetLine) -> Void
    ) {
        self.budgetId = budgetId
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

    static func showsTagPicker(spread: Bool, withdrawal: Bool) -> Bool { !spread && !withdrawal }

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

    private var amountFieldHint: String? {
        guard isSpreadMode else { return nil }
        return amountMode == .total
            ? AppLocale.string("Montant total")
            : AppLocale.string("Montant par mois")
    }

    private var canSubmit: Bool {
        guard (amount ?? 0) > 0, !isLoading else { return false }
        // Withdrawal reroute: the source name is optional (defaults to "Mon épargne").
        if isSavingsWithdrawalMode { return true }
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        // An announcement without a goal names no pot to draw from.
        if isPlannedWithdrawalMode, sourceSavingsGoalId == nil { return false }
        return isSpreadMode ? spreadCalculator.isValid : true
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var validationHint: String? {
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
            title: kind.newBudgetLineTitle,
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            KindToggle(selection: $kind)

            // The band that separates this screen from « Noter » : une fois, ou
            // étalé sur plusieurs mois. It reads before the amount because it
            // decides what the amount means — a monthly share or a total to
            // split. It stays under the nature that governs it: an income can't
            // be spread, so raising it higher would make it flicker in answer to
            // a control further down.
            if kind != .income {
                SpreadModeToggle(selection: $mode, accentColor: kind.color)
            }
            if isSpreadMode {
                SpreadAmountModeToggle(mode: $amountMode, accentColor: kind.color)
            }

            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: amountFieldHint,
                currency: inputCurrency,
                accentColor: kind.color
            )
            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                amountField: .amount,
                color: kind.color,
                currency: inputCurrency
            )
            .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)

            descriptionField

            if Self.showsSavingsGoalPicker(kind: kind) {
                SavingsGoalPickerField(
                    selection: $savingsGoalId,
                    budgetPeriod: Self.savingsGoalPeriod(
                        spreadMonths: isSpreadMode ? spreadCalculator.selectedMonths : [],
                        anchorMonth: anchorMonth,
                        anchorYear: anchorYear
                    )
                )
            }

            if kind == .income {
                originPicker
            }

            if isPlannedWithdrawalMode {
                SavingsGoalPickerField(
                    selection: $sourceSavingsGoalId,
                    mode: .plannedWithdrawal,
                    budgetPeriod: BudgetPeriod(month: anchorMonth, year: anchorYear),
                    withdrawalAmount: convertedAmount
                )
            }

            if isSpreadMode {
                SpreadFormSection(
                    calculator: spreadCalculator,
                    amount: amount,
                    amountMode: amountMode,
                    currency: inputCurrency,
                    accentColor: kind.color
                )
            } else {
                if Self.showsTagPicker(spread: isSpreadMode, withdrawal: isSavingsWithdrawalMode) {
                    TagPickerField(selection: $selectedTagIds)
                }
                // An announced withdrawal is realized by creating the real income,
                // never by arriving already pointed.
                if !Self.forbidsChecked(kind: kind, origin: incomeOrigin) {
                    CheckedToggle(isOn: $isChecked, tintColor: kind.color)
                }
            }

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
            if newKind == .income { mode = .once }
            if newKind != .saving { savingsGoalId = nil }
            if newKind != .income { incomeOrigin = .regular }
            resetIncompatibleOriginState()
        }
        .onChange(of: incomeOrigin) { _, _ in resetIncompatibleOriginState() }
        .task(id: PlannedWithdrawalConversionKey(amount: amount, currency: inputCurrency)) {
            await refreshConvertedAmount()
        }
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: AppLocale.string("Description"),
            accessibilityLabel: AppLocale.string("Description de la prévision"),
            focusBinding: $focusedField,
            field: .description
        )
    }

    // MARK: - Add Button

    private var ctaTitle: String {
        if isSavingsWithdrawalMode { return AppLocale.string("Continuer") }
        if isPlannedWithdrawalMode { return AppLocale.string("Planifier le retrait") }
        return isSpreadMode
            ? AddBudgetLineSpreadLogic.ctaTitle(for: kind)
            : AppLocale.string("Ajouter")
    }

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await submit() } } label: {
                Text(ctaTitle)
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)
            .accessibilityIdentifier("addBudgetLineSubmit")

            if let hint = validationHint {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: validationHint)
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
    .environment(TagStore())
}
