import SwiftUI

/// Sheet for adding a transaction allocated to a specific budget line
struct AddAllocatedTransactionSheet: View {
    let budgetLine: BudgetLine
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var transactionDate = Date()
    @State private var isLoading = false
    @State private var error: Error?

    private let transactionService = TransactionService.shared

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        amount != nil &&
        amount! > 0 &&
        !isLoading
    }

    var body: some View {
        NavigationStack {
            Form {
                // Name
                Section {
                    TextField("Ex: Restaurant, Courses...", text: $name)
                        .font(PulpeTypography.bodyLarge)
                        .listRowBackground(Color.surfaceCard)
                } header: {
                    Text("Description")
                        .font(PulpeTypography.labelLarge)
                }

                // Amount
                Section {
                    CurrencyField(value: $amount, placeholder: "0.00")
                        .listRowBackground(Color.surfaceCard)
                } header: {
                    Text("Montant")
                        .font(PulpeTypography.labelLarge)
                }

                // Date
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

                // Error
                if let error {
                    Section {
                        ErrorBanner(message: error.localizedDescription) {
                            self.error = nil
                        }
                    }
                }
            }
            .navigationTitle(budgetLine.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Ajouter") {
                        Task { await addTransaction() }
                    }
                    .disabled(!canSubmit)
                }
            }
            .loadingOverlay(isLoading)
        }
    }

    private func addTransaction() async {
        guard let amount else { return }

        isLoading = true
        error = nil

        let data = TransactionCreate(
            budgetId: budgetLine.budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: budgetLine.kind,
            budgetLineId: budgetLine.id,
            transactionDate: transactionDate
        )

        do {
            let transaction = try await transactionService.createTransaction(data)
            onAdd(transaction)
            dismiss()
        } catch {
            self.error = error
            isLoading = false
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
}
