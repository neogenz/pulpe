import SwiftUI

/// Sheet for editing an existing budget line (prévision) — hero amount layout
struct EditBudgetLineSheet: View {
    let budgetLine: BudgetLine
    let onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var name: String
    @State private var amount: Decimal?
    @State private var kind: TransactionKind
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var amountText: String

    private let budgetLineService = BudgetLineService.shared

    init(budgetLine: BudgetLine, onUpdate: @escaping (BudgetLine) -> Void) {
        self.budgetLine = budgetLine
        self.onUpdate = onUpdate
        _name = State(initialValue: budgetLine.name)
        _amount = State(initialValue: budgetLine.amount)
        _kind = State(initialValue: budgetLine.kind)
        _amountText = State(initialValue: {
            if let str = Formatters.amountInput.string(from: budgetLine.amount as NSDecimalNumber) {
                return str
            }
            return ""
        }())
    }

    private var canSubmit: Bool {
        guard let amount, amount > 0 else { return false }
        return !name.trimmingCharacters(in: .whitespaces).isEmpty && !isLoading
    }

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Formatters.amountInput.string(from: amount as NSDecimalNumber) ?? "0"
        }
        return "0.00"
    }

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                KindToggle(selection: $kind)
                heroAmountSection
                descriptionField

                if let error {
                    ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                        self.error = nil
                    }
                }

                saveButton
            }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xl)
        }
        .background(Color.surfacePrimary)
        .modernSheet(title: kind.editBudgetLineTitle)
        .loadingOverlay(isLoading)
        .dismissKeyboardOnTap()
    }

    // MARK: - Hero Amount

    private var heroAmountSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(DesignTokens.AmountInput.currencyCode)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textTertiary)

            ZStack {
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused($isAmountFocused)
                    .opacity(0)
                    .frame(width: 0, height: 0)
                    .onChange(of: amountText) { _, newValue in
                        parseAmount(newValue)
                    }

                Text(displayAmount)
                    .font(PulpeTypography.amountHero)
                    .foregroundStyle((amount ?? 0) > 0 ? Color.textPrimary : Color.textTertiary)
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Montant")
            .onTapGesture { isAmountFocused = true }

            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.hairline)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(DesignTokens.Opacity.strong))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isAmountFocused)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.lg)
    }

    // MARK: - Description

    private var descriptionField: some View {
        TextField("Description", text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
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

    private func parseAmount(_ text: String) {
        if let value = text.parsedAsAmount {
            amount = value
        } else {
            amount = nil
        }
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
