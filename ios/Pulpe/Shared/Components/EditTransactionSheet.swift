import SwiftUI

/// Sheet for editing an existing transaction
struct EditTransactionSheet: View {
    let transaction: Transaction
    let onUpdate: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var transactionDate: Date
    @State private var isLoading = false
    @State private var error: Error?

    private let transactionService = TransactionService.shared

    init(transaction: Transaction, onUpdate: @escaping (Transaction) -> Void) {
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
        Form {
            Section {
                TextField("Description", text: $name)
                    .font(PulpeTypography.bodyLarge)
                    .listRowBackground(Color.surfaceCard)
            } header: {
                Text("Description")
                    .font(PulpeTypography.labelLarge)
            }

            Section {
                CurrencyField(value: $amount)
                    .listRowBackground(Color.surfaceCard)
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
                .listRowBackground(Color.surfaceCard)
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
                .listRowBackground(Color.surfaceCard)
            } header: {
                Text("Date")
                    .font(PulpeTypography.labelLarge)
            }

            if let error {
                Section {
                    ErrorBanner(message: error.localizedDescription) {
                        self.error = nil
                    }
                }
            }
            
            Section {
                Button {
                    Task { await updateTransaction() }
                } label: {
                    Text("Enregistrer")
                        .font(PulpeTypography.buttonPrimary)
                        .foregroundStyle(canSubmit ? Color.textOnPrimary : .secondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: DesignTokens.FrameHeight.button)
                        .background(canSubmit ? Color.pulpePrimary : Color.surfaceSecondary)
                        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                }
                .disabled(!canSubmit)
                .buttonStyle(.plain)
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.surfacePrimary)
        .modernSheet(title: "Modifier la transaction")
        .loadingOverlay(isLoading)
    }

    private func updateTransaction() async {
        guard let amount else { return }

        isLoading = true
        error = nil

        let data = TransactionUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            transactionDate: transactionDate
        )

        do {
            let updatedTransaction = try await transactionService.updateTransaction(id: transaction.id, data: data)
            onUpdate(updatedTransaction)
            dismiss()
        } catch {
            self.error = error
            isLoading = false
        }
    }
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
}
