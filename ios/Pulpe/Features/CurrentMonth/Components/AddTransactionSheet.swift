import SwiftUI

/// Sheet for adding a new transaction
struct AddTransactionSheet: View {
    let budgetId: String
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
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
                    TextField("Description", text: $name)
                } header: {
                    Text("Description")
                }

                // Amount
                Section {
                    CurrencyField(value: $amount, placeholder: "0.00")
                } header: {
                    Text("Montant")
                }

                // Kind
                Section {
                    Picker("Type", selection: $kind) {
                        ForEach(TransactionKind.allCases, id: \.self) { type in
                            Label(type.label, systemImage: type.icon)
                                .tag(type)
                        }
                    }
                    .pickerStyle(.segmented)
                } header: {
                    Text("Type")
                }

                // Date
                Section {
                    DatePicker(
                        "Date",
                        selection: $transactionDate,
                        displayedComponents: .date
                    )
                    .datePickerStyle(.graphical)
                } header: {
                    Text("Date")
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
            .navigationTitle("Nouvelle dépense")
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
            budgetId: budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
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
    AddTransactionSheet(budgetId: "test") { transaction in
        print("Added: \(transaction)")
    }
}
