import SwiftUI

/// Sheet for adding a new budget line (prévision) — hero amount layout
struct AddBudgetLineSheet: View {
    let budgetId: String
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var isChecked = false
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false

    private let budgetLineService = BudgetLineService.shared

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
        SheetFormContainer(title: kind.newBudgetLineTitle, isLoading: isLoading, autoFocus: $isAmountFocused) {
            KindToggle(selection: $kind)
            HeroAmountField(
                amount: $amount, amountText: $amountText,
                isFocused: $isAmountFocused, accentColor: kind.color
            )
            QuickAmountChips(amount: $amount, amountText: $amountText, isFocused: $isAmountFocused, color: kind.color)
                .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
            descriptionField
            CheckedToggle(isOn: $isChecked, tintColor: kind.color)

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
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Description")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
            TextField(kind.descriptionPlaceholder, text: $name)
                .font(PulpeTypography.bodyLarge)
                .padding(DesignTokens.Spacing.lg)
                .background(Color.inputBackgroundSoft)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(Color.outlineVariant.opacity(0.5), lineWidth: 1)
                )
                .accessibilityLabel("Description de la prévision")
        }
    }

    // MARK: - Add Button

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await addBudgetLine() } } label: {
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
            recurrence: .oneOff,
            checkedAt: isChecked ? Date() : nil
        )

        do {
            let budgetLine = try await budgetLineService.createBudgetLine(data)
            submitSuccessTrigger.toggle()
            onAdd(budgetLine)
            toastManager.show("Prévision ajoutée")
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
    .environment(ToastManager())
}
