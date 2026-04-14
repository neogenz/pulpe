import SwiftUI

/// Sheet for editing an existing transaction
struct EditTransactionSheet: View {
    let transaction: Transaction
    let onUpdate: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var transactionDate: Date
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText: String
    @State private var submitSuccessTrigger = false
    @State private var inputCurrency: SupportedCurrency = .chf

    private let dependencies: EditTransactionDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        transaction: Transaction,
        dependencies: EditTransactionDependencies = .live,
        onUpdate: @escaping (Transaction) -> Void
    ) {
        self.dependencies = dependencies
        self.transaction = transaction
        self.onUpdate = onUpdate
        _name = State(initialValue: transaction.name)
        _amount = State(initialValue: transaction.amount)
        _kind = State(initialValue: transaction.kind)
        _transactionDate = State(initialValue: transaction.transactionDate)
        let amountString = Formatters.amountInput.string(from: transaction.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)
    }

    static func isFormValid(name: String, amount: Decimal?, isLoading: Bool) -> Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    private var canSubmit: Bool {
        Self.isFormValid(name: name, amount: amount, isLoading: isLoading)
    }

    var body: some View {
        SheetFormContainer(
            title: "Modifier la transaction",
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
                originalAmount: transaction.originalAmount,
                originalCurrency: transaction.originalCurrency,
                exchangeRate: transaction.exchangeRate
            )

            descriptionField
            dateSelector

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
            accessibilityLabel: "Description de la transaction",
            focusBinding: $focusedField,
            field: .description
        )
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        TransactionDateSelector(date: $transactionDate)
    }

    // MARK: - Save Button

    private var saveButton: some View {
        Button {
            Task { await updateTransaction() }
        } label: {
            Text("Enregistrer")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func updateTransaction() async {
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

            let data = TransactionUpdate(
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                transactionDate: transactionDate,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate
            )

            let updatedTransaction = try await dependencies.updateTransaction(transaction.id, data)
            submitSuccessTrigger.toggle()
            onUpdate(updatedTransaction)
            toastManager.show("Transaction modifiée")
            dismiss()
        } catch {
            self.error = error
        }
    }
}

struct EditTransactionDependencies: Sendable {
    var updateTransaction: @Sendable (String, TransactionUpdate) async throws -> Transaction

    static let live = EditTransactionDependencies(
        updateTransaction: { id, data in
            try await TransactionService.shared.updateTransaction(id: id, data: data)
        }
    )
}

#Preview {
    EditTransactionSheet(
        transaction: Transaction(
            id: "test",
            budgetId: "budget-1",
            budgetLineId: nil,
            name: "Test Transaction",
            amount: 50,
            kind: .expense,
            transactionDate: Date(),
            category: nil,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    ) { transaction in
        print("Updated: \(transaction)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
