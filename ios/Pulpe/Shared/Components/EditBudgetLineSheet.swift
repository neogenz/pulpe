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
    private let inputCurrency: SupportedCurrency
    private let isAlternateCurrency: Bool

    private let dependencies: EditBudgetLineDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        budgetLine: BudgetLine,
        userCurrency: SupportedCurrency,
        dependencies: EditBudgetLineDependencies = .live,
        onUpdate: @escaping (BudgetLine) -> Void
    ) {
        self.budgetLine = budgetLine
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: budgetLine.name)
        _kind = State(initialValue: budgetLine.kind)

        let editableAmount = Self.initialAmount(for: budgetLine, userCurrency: userCurrency)
        _amount = State(initialValue: editableAmount)
        let amountString = Formatters.amountInput.string(from: editableAmount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)

        self.inputCurrency = budgetLine.originalCurrency ?? userCurrency
        self.isAlternateCurrency = Self.shouldShowAlternateCurrency(for: budgetLine, userCurrency: userCurrency)
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
            if userSettingsStore.showCurrencySelectorEffective && isAlternateCurrency {
                CurrencyAmountPicker(
                    selectedCurrency: .constant(inputCurrency),
                    isReadOnly: true
                )
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
            let conversion: CurrencyConversion? = if isAlternateCurrency {
                try await conversionService.convert(
                    amount: amount,
                    from: inputCurrency,
                    to: userSettingsStore.currency
                )
            } else {
                nil
            }

            let data = Self.buildUpdate(
                id: budgetLine.id,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                conversion: conversion
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

    // MARK: - Pure Helpers (testable)

    static func shouldShowAlternateCurrency(
        for line: BudgetLine,
        userCurrency: SupportedCurrency
    ) -> Bool {
        guard let lineCurrency = line.originalCurrency else { return false }
        return lineCurrency != userCurrency
    }

    /// Amount to pre-fill in the input. Uses `originalAmount` only when the line is
    /// in an alternate currency — otherwise the converted amount would confuse users.
    static func initialAmount(for line: BudgetLine, userCurrency: SupportedCurrency) -> Decimal {
        if shouldShowAlternateCurrency(for: line, userCurrency: userCurrency),
           let originalAmount = line.originalAmount {
            return originalAmount
        }
        return line.amount
    }

    /// Builds the update DTO. When the line is mono-currency (or flag-off fallback),
    /// currency metadata is omitted so the backend preserves the existing values.
    static func buildUpdate(
        id: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        conversion: CurrencyConversion?
    ) -> BudgetLineUpdate {
        guard let conversion else {
            return BudgetLineUpdate(
                id: id,
                name: name,
                amount: amount,
                kind: kind,
                isManuallyAdjusted: true
            )
        }
        return BudgetLineUpdate(
            id: id,
            name: name,
            amount: conversion.convertedAmount,
            kind: kind,
            isManuallyAdjusted: true,
            originalAmount: conversion.originalAmount,
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate
        )
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
        ),
        userCurrency: .chf
    ) { line in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
