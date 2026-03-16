import SwiftUI

/// Sheet for editing an existing transaction
struct EditTransactionSheet: View {
    let transaction: Transaction
    let onUpdate: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var transactionDate: Date
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText: String
    @State private var submitSuccessTrigger = false

    private let dependencies: EditTransactionDependencies

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
        SheetFormContainer(title: "Modifier la transaction", isLoading: isLoading, autoFocus: $isAmountFocused) {
            KindToggle(selection: $kind)
            HeroAmountField(
                amount: $amount, amountText: $amountText,
                isFocused: $isAmountFocused, accentColor: kind.color
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
            accessibilityLabel: "Description de la transaction"
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

        let data = TransactionUpdate(
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            transactionDate: transactionDate
        )

        do {
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
}
