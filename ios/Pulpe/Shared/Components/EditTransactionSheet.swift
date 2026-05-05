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
    private let inputCurrency: SupportedCurrency
    private let isAlternateCurrency: Bool

    private let dependencies: EditTransactionDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        transaction: Transaction,
        userCurrency: SupportedCurrency,
        dependencies: EditTransactionDependencies = .live,
        onUpdate: @escaping (Transaction) -> Void
    ) {
        self.dependencies = dependencies
        self.transaction = transaction
        self.onUpdate = onUpdate
        _name = State(initialValue: transaction.name)
        _kind = State(initialValue: transaction.kind)
        _transactionDate = State(initialValue: transaction.transactionDate)

        let editableAmount = Self.initialAmount(for: transaction, userCurrency: userCurrency)
        _amount = State(initialValue: editableAmount)
        let amountString = Formatters.amountInput.string(from: editableAmount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)

        self.inputCurrency = transaction.originalCurrency ?? userCurrency
        self.isAlternateCurrency = Self.shouldShowAlternateCurrency(for: transaction, userCurrency: userCurrency)
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
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                transactionDate: transactionDate,
                conversion: conversion
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

    // MARK: - Pure Helpers (testable)

    static func shouldShowAlternateCurrency(
        for transaction: Transaction,
        userCurrency: SupportedCurrency
    ) -> Bool {
        guard let txCurrency = transaction.originalCurrency else { return false }
        return txCurrency != userCurrency
    }

    static func initialAmount(for transaction: Transaction, userCurrency: SupportedCurrency) -> Decimal {
        if shouldShowAlternateCurrency(for: transaction, userCurrency: userCurrency),
           let originalAmount = transaction.originalAmount {
            return originalAmount
        }
        return transaction.amount
    }

    static func buildUpdate(
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        transactionDate: Date,
        conversion: CurrencyConversion?
    ) -> TransactionUpdate {
        guard let conversion else {
            return TransactionUpdate(
                name: name,
                amount: amount,
                kind: kind,
                transactionDate: transactionDate
            )
        }
        return TransactionUpdate(
            name: name,
            amount: conversion.convertedAmount,
            kind: kind,
            transactionDate: transactionDate,
            originalAmount: conversion.originalAmount,
            originalCurrency: conversion.originalCurrency,
            targetCurrency: conversion.targetCurrency,
            exchangeRate: conversion.exchangeRate
        )
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
        ),
        userCurrency: .chf
    ) { transaction in
        print("Updated: \(transaction)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(FeatureFlagsStore())
}
