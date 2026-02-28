import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText = ""

    private let budgetLineService = BudgetLineService.shared

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
    }

    var body: some View {
        SheetFormContainer(title: kind.newBudgetLineTitle, isLoading: isLoading, autoFocus: $isAmountFocused) {
            KindToggle(selection: $kind)
            HeroAmountField(amount: $amount, amountText: $amountText, isFocused: $isAmountFocused)
            QuickAmountChips(amount: $amount, amountText: $amountText, isFocused: $isAmountFocused, color: kind.color)
                .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
            descriptionField

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            addButton
        }
    }

    // MARK: - Description

    private var descriptionField: some View {
        TextField(kind.descriptionPlaceholder, text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Add Button

    private var addButton: some View {
        Button {
            Task { await addBudgetLine() }
        } label: {
            Text("Ajouter")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
    }

    // MARK: - Logic

    private func addBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
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
        }
    }
}

#Preview {
    AddBudgetLineSheet(budgetId: "test") { line in
        print("Added: \(line)")
    }
}
