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
    /// PUL-292 — income-only, OFF by default. ON reroutes the CTA to the
    /// "piocher dans son épargne" preview, prefilled.
    @State private var remitNextMonth = false
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

    var isSavingsWithdrawalMode: Bool { kind == .income && remitNextMonth }

    private var amountFieldHint: String? {
        guard isSpreadMode else { return nil }
        return amountMode == .total ? "Montant total" : "Montant par mois"
    }

    private var canSubmit: Bool {
        guard (amount ?? 0) > 0, !isLoading else { return false }
        // Withdrawal reroute: the source name is optional (defaults to "Mon épargne").
        if isSavingsWithdrawalMode { return true }
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        return isSpreadMode ? spreadCalculator.isValid : true
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var validationHint: String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return "Ajoute un montant" }
        if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
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

            if kind != .income {
                SpreadModeToggle(selection: $mode, accentColor: kind.color)
            }

            descriptionField

            if Self.showsSavingsGoalPicker(kind: kind) {
                SavingsGoalPickerField(
                    selection: $savingsGoalId,
                    budgetPeriod: BudgetPeriod(month: anchorMonth, year: anchorYear)
                )
            }

            if isSpreadMode {
                SpreadAmountModeToggle(mode: $amountMode, accentColor: kind.color)
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
                if kind == .income {
                    remitToggle
                }
                if !isSavingsWithdrawalMode {
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
            // Income can't be spread; only savings carry a goal; remit is income-only.
            if newKind == .income { mode = .once }
            if newKind != .saving { savingsGoalId = nil }
            if newKind != .income { remitNextMonth = false }
        }
    }

    // MARK: - Remets le mois prochain (PUL-292)

    private var remitToggle: some View {
        Toggle("Je remets cet argent le mois prochain", isOn: $remitNextMonth)
            .font(PulpeTypography.bodyLarge)
            .tint(kind.color)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .accessibilityHint("Crée une épargne le mois prochain pour reconstituer cette somme")
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Description de la prévision",
            focusBinding: $focusedField,
            field: .description
        )
    }

    // MARK: - Add Button

    private var ctaTitle: String {
        if isSavingsWithdrawalMode { return "Continuer" }
        return isSpreadMode ? AddBudgetLineSpreadLogic.ctaTitle(for: kind) : "Ajouter"
    }

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await submit() } } label: {
                Text(ctaTitle)
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)

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
