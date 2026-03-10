import SwiftUI

/// Sheet for editing an existing transaction
struct EditTransactionSheet: View {
    let transaction: Transaction
    let onUpdate: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var transactionDate: Date
    @State private var isLoading = false
    @State private var error: Error?
    @State private var inputCurrency = "CHF"

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
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(kind.descriptionPlaceholder, text: $name)
                        .font(PulpeTypography.bodyLarge)
                        .listRowBackground(Color.surfaceContainerHigh)
                } header: {
                    Text("Description")
                        .font(PulpeTypography.labelLarge)
                }

                Section {
                    if userSettingsStore.showCurrencySelector {
                        CurrencyAmountPicker(selectedCurrency: $inputCurrency, baseCurrency: userSettingsStore.currency)
                            .listRowBackground(Color.surfaceContainerHigh)
                    }
                    CurrencyField(value: $amount, currency: inputCurrency, visualStyle: .flat)
                        .listRowBackground(Color.surfaceContainerHigh)
                    CurrencyConversionBadge(
                        originalAmount: transaction.originalAmount,
                        originalCurrency: transaction.originalCurrency,
                        exchangeRate: transaction.exchangeRate
                    )
                    .listRowBackground(Color.surfaceContainerHigh)
                } header: {
                    Text("Montant")
                        .font(PulpeTypography.labelLarge)
                }

                Section {
                    Picker("Type", selection: $kind) {
                        ForEach(TransactionKind.allCases, id: \.self) { type in
                            Label(type.label, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.surfaceContainerHigh)
                } header: {
                    Text("Type")
                        .font(PulpeTypography.labelLarge)
                }

                Section {
                    DatePicker(
                        "Date",
                        selection: $transactionDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                    .listRowBackground(Color.surfaceContainerHigh)
                } header: {
                    Text("Date")
                        .font(PulpeTypography.labelLarge)
                }

                if let error {
                    Section {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            self.error = nil
                        }
                    }
                }

                Section {
                    Button {
                        Task { await updateTransaction() }
                    } label: {
                        Text("Enregistrer")
                    }
                    .disabled(!canSubmit)
                    .primaryButtonStyle(isEnabled: canSubmit)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.surface)
            .navigationTitle("Modifier la transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
            .loadingOverlay(isLoading)
        }
        .standardSheetPresentation()
        .onAppear { inputCurrency = userSettingsStore.currency }
    }

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
            onUpdate(updatedTransaction)
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
    .environment(UserSettingsStore())
}
