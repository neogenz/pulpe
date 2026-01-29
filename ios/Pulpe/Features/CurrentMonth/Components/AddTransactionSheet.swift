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

    private let transactionService = TransactionService.shared
    private let quickAmounts = [10, 15, 20, 30]

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading
    }

    private static let amountFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = "'"
        return formatter
    }()

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Self.amountFormatter.string(from: amount as NSDecimalNumber) ?? "0"
        }
        return "0.00"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    heroAmountSection
                    quickAmountChips
                    descriptionField
                    kindSelector
                    dateSelector

                    if let error {
                        ErrorBanner(message: error.localizedDescription) {
                            self.error = nil
                        }
                    }

                    addButton
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.xxxl)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .background(Color.surfacePrimary)
            .navigationTitle("Nouvelle dépense")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .loadingOverlay(isLoading)
            .task {
                try? await Task.sleep(nanoseconds: 200_000_000)
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
    }

    // MARK: - Hero Amount

    private var heroAmountSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("CHF")
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
                    .animation(.snappy(duration: 0.2), value: amount)
            }
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Montant")
            .onTapGesture { isAmountFocused = true }

            // Subtle underline
            RoundedRectangle(cornerRadius: 1)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(0.3))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: 0.2), value: isAmountFocused)
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
                    Text("\(quickAmount) CHF")
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
                    withAnimation(.easeInOut(duration: 0.2)) {
                        kind = type
                    }
                } label: {
                    Label(type.label, systemImage: type.icon)
                        .font(PulpeTypography.buttonSecondary)
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm + 2)
                        .frame(maxWidth: .infinity)
                        .background(kind == type ? Color.pulpePrimary : Color.surfaceSecondary)
                        .foregroundStyle(kind == type ? Color.textOnPrimary : Color.textPrimary)
                        .clipShape(Capsule())
                }
                .buttonStyle(.plain)
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
                .font(PulpeTypography.buttonPrimary)
                .foregroundStyle(Color.textOnPrimary)
                .frame(maxWidth: .infinity)
                .frame(height: DesignTokens.FrameHeight.button)
                .background(Color.pulpePrimary)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                .opacity(canSubmit ? 1 : 0.4)
        }
        .disabled(!canSubmit)
        .buttonStyle(.plain)
    }

    // MARK: - Logic

    private func parseAmount(_ text: String) {
        let cleaned = text
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }

        let components = cleaned.split(separator: ".")
        let sanitized: String
        if components.count > 1 {
            let fractional = String(components.dropFirst().joined().prefix(2))
            sanitized = "\(components[0]).\(fractional)"
        } else {
            sanitized = cleaned
        }

        if let decimal = Decimal(string: sanitized) {
            amount = decimal
        } else if sanitized.isEmpty {
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
