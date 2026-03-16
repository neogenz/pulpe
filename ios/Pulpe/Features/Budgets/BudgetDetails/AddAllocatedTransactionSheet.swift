import SwiftUI

/// Sheet for adding a transaction allocated to a specific budget line
struct AddAllocatedTransactionSheet: View {
    let budgetLine: BudgetLine
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var transactionDate = Date()
    @State private var isChecked = false
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false

    private let dependencies: AddAllocatedTransactionDependencies

    init(
        budgetLine: BudgetLine,
        dependencies: AddAllocatedTransactionDependencies = .live,
        onAdd: @escaping (Transaction) -> Void
    ) {
        self.budgetLine = budgetLine
        self.dependencies = dependencies
        self.onAdd = onAdd
    }

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var validationHint: String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return "Ajoute un montant" }
        if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
        return nil
    }

    var body: some View {
        SheetFormContainer(title: budgetLine.name, isLoading: isLoading, autoFocus: $isAmountFocused) {
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                accentColor: budgetLine.kind.color
            )
            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                color: budgetLine.kind.color
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
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: budgetLine.kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Description de la transaction"
        )
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        TransactionDateSelector(date: $transactionDate)
    }

    // MARK: - Add Button

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button {
                Task { await addTransaction() }
            } label: {
                Text("Ajouter")
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)

            if let hint = validationHint {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: validationHint)
    }

    // MARK: - Logic

    private func addTransaction() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        let data = TransactionCreate(
            budgetId: budgetLine.budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: budgetLine.kind,
            budgetLineId: budgetLine.id,
            transactionDate: transactionDate,
            checkedAt: isChecked ? Date() : nil
        )

        do {
            let transaction = try await dependencies.createTransaction(data)
            submitSuccessTrigger.toggle()
            onAdd(transaction)
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }
}

struct AddAllocatedTransactionDependencies: Sendable {
    var createTransaction: @Sendable (TransactionCreate) async throws -> Transaction

    static let live = AddAllocatedTransactionDependencies(
        createTransaction: { data in
            try await TransactionService.shared.createTransaction(data)
        }
    )
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
}
