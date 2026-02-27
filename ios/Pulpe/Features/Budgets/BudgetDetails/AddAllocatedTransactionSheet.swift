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
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var pendingQuickAmount: Int?
    @State private var amountText = ""

    private let transactionService = TransactionService.shared
    private let quickAmounts = DesignTokens.AmountInput.quickAmounts

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    HeroAmountField(amount: $amount, amountText: $amountText, isFocused: $isAmountFocused)
                    quickAmountChips
                    descriptionField
                    dateSelector

                    if let error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            self.error = nil
                        }
                    }

                    addButton
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .background(Color.surfacePrimary)
            .navigationTitle(budgetLine.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
            .loadingOverlay(isLoading)
            .dismissKeyboardOnTap()
            .task {
                try? await Task.sleep(for: .milliseconds(200))
                isAmountFocused = true
            }
            .onChange(of: isAmountFocused) { _, isFocused in
                if !isFocused, let quickAmount = pendingQuickAmount {
                    amount = Decimal(quickAmount)
                    amountText = "\(quickAmount)"
                    pendingQuickAmount = nil
                }
            }
        }
        .standardSheetPresentation()
    }

    // MARK: - Quick Amounts

    private var quickAmountChips: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(quickAmounts, id: \.self) { quickAmount in
                Button {
                    if isAmountFocused {
                        pendingQuickAmount = quickAmount
                        isAmountFocused = false
                    } else {
                        amount = Decimal(quickAmount)
                        amountText = "\(quickAmount)"
                    }
                } label: {
                    Text("\(quickAmount) \(DesignTokens.AmountInput.currencyCode)")
                        .font(PulpeTypography.buttonSecondary)
                        .fixedSize()
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(Color.pulpePrimary.opacity(DesignTokens.Opacity.accent))
                        .foregroundStyle(Color.pulpePrimary)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Description

    private var descriptionField: some View {
        TextField(budgetLine.kind.descriptionPlaceholder, text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        HStack {
            Label("Date", systemImage: "calendar")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)

            Spacer()

            DatePicker(
                "",
                selection: $transactionDate,
                displayedComponents: .date
            )
            .labelsHidden()
            .datePickerStyle(.compact)
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.inputBackgroundSoft)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Add Button

    private var addButton: some View {
        Button {
            Task { await addTransaction() }
        } label: {
            Text("Ajouter")
        }
        .disabled(!canSubmit)
        .primaryButtonStyle(isEnabled: canSubmit)
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
            transactionDate: transactionDate
        )

        do {
            let transaction = try await transactionService.createTransaction(data)
            onAdd(transaction)
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
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
    .environment(ToastManager())
}
