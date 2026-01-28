import SwiftUI

/// Sheet for adding a new budget line (prévision)
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var isLoading = false
    @State private var error: Error?

    private let budgetLineService = BudgetLineService.shared

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

                // Kind
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

                // Error
                if let error {
                    Section {
                        ErrorBanner(message: error.localizedDescription) {
                            self.error = nil
                        }
                    }
                }
            }
            .navigationTitle("Nouvelle prévision")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Ajouter") {
                        Task { await addBudgetLine() }
                    }
                    .disabled(!canSubmit)
                }
            }
            .loadingOverlay(isLoading)
        }
    }

    private func addBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        error = nil

        let data = BudgetLineCreate(
            budgetId: budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            recurrence: .oneOff
        )

        do {
            let budgetLine = try await budgetLineService.createBudgetLine(data)
            onAdd(budgetLine)
            dismiss()
        } catch {
            self.error = error
            isLoading = false
        }
    }
}

#Preview {
    AddBudgetLineSheet(budgetId: "test") { line in
        print("Added: \(line)")
    }
}
