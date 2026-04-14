import SwiftUI

/// Sheet for editing an existing budget line (prévision) — hero amount layout
struct EditBudgetLineSheet: View {
    let budgetLine: BudgetLine
    let onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @State private var inputCurrency: SupportedCurrency = .chf

    private let dependencies: EditBudgetLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        budgetLine: BudgetLine,
        dependencies: EditBudgetLineDependencies = .live,
        onUpdate: @escaping (BudgetLine) -> Void
    ) {
        self.budgetLine = budgetLine
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: budgetLine.name)
        _amount = State(initialValue: budgetLine.amount)
        _kind = State(initialValue: budgetLine.kind)
        let amountString = Formatters.amountInput.string(from: budgetLine.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(
            title: kind.editBudgetLineTitle,
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            KindToggle(selection: $kind)
            if userSettingsStore.showCurrencySelectorEffective {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency, baseCurrency: userSettingsStore.currency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                currency: inputCurrency,
                accentColor: kind.color
            )
            CurrencyConversionBadge(
                originalAmount: budgetLine.originalAmount,
                originalCurrency: budgetLine.originalCurrency,
                exchangeRate: budgetLine.exchangeRate
            )
            descriptionField

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            saveButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear { inputCurrency = userSettingsStore.currency }
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

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            Task { await updateBudgetLine() }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func updateBudgetLine() async {
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

            let data = BudgetLineUpdate(
                id: budgetLine.id,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                isManuallyAdjusted: true,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate
            )

            let updatedLine = try await dependencies.updateBudgetLine(budgetLine.id, data)
            submitSuccessTrigger.toggle()
            onUpdate(updatedLine)
            toastManager.show("Prévision modifiée")
            dismiss()
        } catch {
            self.error = error
        }
    }
}

struct EditBudgetLineDependencies: Sendable {
    var updateBudgetLine: @Sendable (String, BudgetLineUpdate) async throws -> BudgetLine

    static let live = EditBudgetLineDependencies(
        updateBudgetLine: { id, data in
            try await BudgetLineService.shared.updateBudgetLine(id: id, data: data)
        }
    )
}

#Preview {
    EditBudgetLineSheet(
        budgetLine: BudgetLine(
            id: "test",
            budgetId: "budget-1",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Test Budget Line",
            amount: 100,
            kind: .expense,
            recurrence: .fixed,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    ) { line in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
