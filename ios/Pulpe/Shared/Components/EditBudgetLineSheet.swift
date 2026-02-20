import SwiftUI

/// Sheet for editing an existing budget line (prévision)
struct EditBudgetLineSheet: View {
    let budgetLine: BudgetLine
    let onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var isLoading = false
    @State private var error: Error?

    private let budgetLineService = BudgetLineService.shared

    init(budgetLine: BudgetLine, onUpdate: @escaping (BudgetLine) -> Void) {
        self.budgetLine = budgetLine
        self.onUpdate = onUpdate
        _name = State(initialValue: budgetLine.name)
        _amount = State(initialValue: budgetLine.amount)
        _kind = State(initialValue: budgetLine.kind)
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

            if let error {
                Section {
                    ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                        self.error = nil
                    }
                }
            }
            
            Section {
                Button {
                    Task { await updateBudgetLine() }
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
        .background(Color.surfacePrimary)
        .modernSheet(title: "Modifier la prévision")
        .loadingOverlay(isLoading)
    }

    private func updateBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        error = nil

        let data = BudgetLineUpdate(
            id: budgetLine.id,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            isManuallyAdjusted: true
        )

        do {
            let updatedLine = try await budgetLineService.updateBudgetLine(id: budgetLine.id, data: data)
            onUpdate(updatedLine)
            dismiss()
        } catch {
            self.error = error
            isLoading = false
        }
    }
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
}
