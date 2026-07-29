import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void
    /// PUL-292: routes the CTA to a prefilled withdrawal instead of creating plain income.
    let onRequestSavingsWithdrawal: ((SavingsWithdrawalPrefill) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var savingsGoalId: String?
    @State private var selectedTagIds: Set<String> = []
    @State private var isChecked = false
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false
    @State private var inputCurrency: SupportedCurrency = .chf
    @State private var mode: BudgetLineCreationMode = .once
    @State private var amountMode: SpreadAmountMode = .total
    /// PUL-292: income-only; reroutes the CTA to a prefilled withdrawal.
    @State private var remitNextMonth = false
    @State private var spreadCalculator: SpreadCalculator
    /// One idempotency key per sheet, replayed on retries (PUL-17).
    @State private var spreadGroupId = UUID().uuidString.lowercased()

    private let anchorMonth: Int
    private let anchorYear: Int
    private let dependencies: AddBudgetLineDependencies
    private let conversionService = CurrencyConversionService.shared
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

    private var isSpreadMode: Bool { mode == .spread }

    static func showsTagPicker(spread: Bool, withdrawal: Bool) -> Bool { !spread && !withdrawal }

    static func showsSavingsGoalPicker(kind: TransactionKind) -> Bool { kind == .saving }

    private var isSavingsWithdrawalMode: Bool { kind == .income && remitNextMonth }

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
                SavingsGoalPickerField(selection: $savingsGoalId)
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

    // MARK: - Logic

    /// Routes to the withdrawal, spread, or single-line flow.
    private func submit() async {
        if isSavingsWithdrawalMode {
            routeToSavingsWithdrawal()
        } else if isSpreadMode {
            await addSpread()
        } else {
            await addBudgetLine()
        }
    }

    /// Hands a prefilled withdrawal intent to the router (PUL-292).
    private func routeToSavingsWithdrawal() {
        guard let amount, amount > 0 else { return }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        onRequestSavingsWithdrawal?(
            SavingsWithdrawalPrefill(
                budgetId: budgetId,
                anchorMonth: anchorMonth,
                anchorYear: anchorYear,
                amount: amount,
                inputCurrency: inputCurrency,
                source: trimmed.isEmpty ? nil : trimmed,
                startsAtPreview: true
            )
        )
    }

    private func addBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )

            let data = BudgetLineCreate(
                budgetId: budgetId,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                recurrence: .oneOff,
                savingsGoalId: kind.savingsGoalLink(savingsGoalId),
                checkedAt: isChecked ? Date() : nil,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate,
                tagIds: TagPickerField.createdTagIds(from: selectedTagIds)
            )

            let budgetLine = try await dependencies.createBudgetLine(data)
            submitSuccessTrigger.toggle()
            onAdd(budgetLine)
            toastManager.show("Prévision ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }

    /// Fans the per-month amount over every SELECTED month (PUL-17, interp. B).
    /// FX frozen once (one shared `exchangeRate`). Cross-budget caches are
    /// invalidated OUTSIDE any coordinator (a spread touches N months it doesn't
    /// own); the occurrence in the open budget is fed back via `onAdd`.
    private func addSpread() async {
        guard let amount, spreadCalculator.isValid else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            let data = AddBudgetLineSpreadLogic.buildCreate(
                calculator: spreadCalculator,
                input: AddBudgetLineSpreadLogic.SubmitInput(
                    name: name,
                    kind: kind,
                    amount: amount,
                    mode: amountMode,
                    conversion: conversion,
                    spreadGroupId: spreadGroupId,
                    savingsGoalId: savingsGoalId
                )
            )

            let response = try await dependencies.createSpread(data)

            // Refresh the active screen via the single-line `onAdd` seam when an
            // occurrence landed in the open budget (PUL-270).
            if let openLine = response.lines.first(where: { $0.budgetId == budgetId }) {
                onAdd(openLine)
            }

            // Cross-budget invalidation OUTSIDE the coordinator, for the OTHER
            // months it doesn't own (PUL-17).
            dependencies.invalidateCrossBudgetCaches(budgetListStore)

            submitSuccessTrigger.toggle()
            toastManager.show(AddBudgetLineSpreadLogic.successMessage(for: response))
            dismiss()
        } catch {
            self.error = error
        }
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
