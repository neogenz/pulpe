import SwiftUI

/// Sheet for adding a new transaction — fintech-inspired hero amount layout
struct AddTransactionSheet: View {
    let budgetId: String
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var transactionDate = Date()
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var isAmountFocused: Bool
    @State private var pendingQuickAmount: Int?
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false

    private let transactionService = TransactionService.shared
    private let quickAmounts = DesignTokens.AmountInput.quickAmounts

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
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
                heroAmountSection
                quickAmountChips
                descriptionField
                kindSelector
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
        .modernSheet(title: "Nouvelle dépense")
        .loadingOverlay(isLoading)
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
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

    // MARK: - Hero Amount

    private var heroAmountSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(DesignTokens.AmountInput.currencyCode)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textTertiary)

            ZStack {
                // Hidden input field
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused($isAmountFocused)
                    .opacity(0)
                    .frame(width: 0, height: 0)
                    .onChange(of: amountText) { _, newValue in
                        parseAmount(newValue)
                    }

                // Visible display
                Text(displayAmount)
                    .font(PulpeTypography.amountHero)
                    .foregroundStyle((amount ?? 0) > 0 ? Color.textPrimary : Color.textTertiary)
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Montant")
            .onTapGesture { isAmountFocused = true }

            // Subtle underline
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.hairline)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(DesignTokens.Opacity.strong))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isAmountFocused)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.lg)
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
                        .font(PulpeTypography.labelLarge)
                        .fixedSize()
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(Color.pulpePrimary.opacity(0.12))
                        .foregroundStyle(Color.pulpePrimary)
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(Color.pulpePrimary.opacity(0.20), lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Description

    private var descriptionField: some View {
        TextField("Description", text: $name)
            .font(PulpeTypography.bodyLarge)
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Kind Selector (Custom Pills)

    private var kindSelector: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(TransactionKind.allCases, id: \.self) { type in
                Button {
                    withAnimation(.easeInOut(duration: DesignTokens.Animation.fast)) {
                        kind = type
                    }
                } label: {
                    Label(type.label, systemImage: type.icon)
                        .font(PulpeTypography.buttonSecondary)
                        .fontWeight(kind == type ? .semibold : .medium)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm + 2)
                        .frame(maxWidth: .infinity)
                        .background(kind == type ? Color.pulpePrimary : Color.surfaceSecondary)
                        .foregroundStyle(kind == type ? Color.textOnPrimary : .primary)
                        .clipShape(Capsule())
                        .overlay(
                            kind == type ? nil :
                            Capsule().strokeBorder(Color.primary.opacity(0.08), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
                .sensoryFeedback(.selection, trigger: kind)
            }
        }
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

    private func parseAmount(_ text: String) {
        if let value = text.parsedAsAmount {
            amount = value
        } else {
            amount = nil
        }
    }

    private func addTransaction() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
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
            submitSuccessTrigger.toggle()
            onAdd(transaction)
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }
}

#Preview {
    AddTransactionSheet(budgetId: "test") { transaction in
        print("Added: \(transaction)")
    }
}
