import SwiftUI

/// Sheet for editing an existing budget line (prévision) — hero amount layout
struct EditBudgetLineSheet: View {
    let budgetLine: BudgetLine
    let onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText: String
    @State private var submitSuccessTrigger = false

    private let dependencies: EditBudgetLineDependencies

    init(
        budgetLine: BudgetLine,
        dependencies: EditBudgetLineDependencies = .live,
        onUpdate: @escaping (BudgetLine) -> Void
    ) {
        self.budgetLine = budgetLine
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        _name = State(initialValue: budgetLine.name)
        _amount = State(initialValue: budgetLine.amount)
        _kind = State(initialValue: budgetLine.kind)
        let amountString = Formatters.amountInput.string(from: budgetLine.amount as NSDecimalNumber) ?? ""
        _amountText = State(initialValue: amountString)
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    var body: some View {
        SheetFormContainer(title: kind.editBudgetLineTitle, isLoading: isLoading, autoFocus: $isAmountFocused) {
            KindToggle(selection: $kind)
            HeroAmountField(
                amount: $amount, amountText: $amountText,
                isFocused: $isAmountFocused, accentColor: kind.color
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
            accessibilityLabel: "Description de la prévision"
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

        let data = BudgetLineUpdate(
            id: budgetLine.id,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            isManuallyAdjusted: true
        )

        do {
            let updatedLine = try await dependencies.updateBudgetLine(budgetLine.id, data)
            submitSuccessTrigger.toggle()
            onUpdate(updatedLine)
            toastManager.show("Prévision modifiée")
            dismiss()
        } catch {
            self.error = error
        }
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
        )
    ) { line in
        print("Updated: \(line)")
    }
    .environment(ToastManager())
}
