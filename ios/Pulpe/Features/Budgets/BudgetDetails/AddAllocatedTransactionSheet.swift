import SwiftUI

/// Sheet for adding a transaction allocated to a specific budget line
struct AddAllocatedTransactionSheet: View {
    let budgetLine: BudgetLine
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var transactionDate = Date()
    @State private var isChecked = false
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText = ""
    @State private var inputCurrency = "CHF"

    private let transactionService = TransactionService.shared
    private let conversionService = CurrencyConversionService.shared

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
    }

    var body: some View {
        SheetFormContainer(title: budgetLine.name, isLoading: isLoading, autoFocus: $isAmountFocused) {
            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency, baseCurrency: userSettingsStore.currency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                currency: inputCurrency,
                accentColor: budgetLine.kind.color
            )
            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                color: budgetLine.kind.color,
                currency: inputCurrency
            )
            descriptionField
            dateSelector
            CheckedToggle(isOn: $isChecked, tintColor: budgetLine.kind.color)

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            addButton
        }
        .onAppear { inputCurrency = userSettingsStore.currency }
    }

    // MARK: - Description

    private var descriptionField: some View {
        TextField(budgetLine.kind.descriptionPlaceholder, text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        HStack {
            Label("Date", systemImage: "calendar")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            DatePicker(
                "",
                selection: $transactionDate,
                displayedComponents: .date
            )
            .labelsHidden()
            .datePickerStyle(.compact)
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Add Button

    private var addButton: some View {
        Button {
            Task { await addTransaction() }
        } label: {
            Text("Ajouter")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func addTransaction() async {
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

            let data = TransactionCreate(
                budgetId: budgetLine.budgetId,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: budgetLine.kind,
                budgetLineId: budgetLine.id,
                transactionDate: transactionDate,
                checkedAt: isChecked ? Date() : nil,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate
            )

            let transaction = try await transactionService.createTransaction(data)
            onAdd(transaction)
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }
}

#Preview {
    AddAllocatedTransactionSheet(
        budgetLine: BudgetLine(
            id: "1",
            budgetId: "b1",
            templateLineId: nil,
            savingsGoalId: nil,
            name: "Courses",
            amount: 500,
            kind: .expense,
            recurrence: .oneOff,
            isManuallyAdjusted: false,
            checkedAt: nil,
            createdAt: Date(),
            updatedAt: Date()
        )
    ) { transaction in
        print("Added: \(transaction)")
    }
    .environment(ToastManager())
    .environment(UserSettingsStore())
}
