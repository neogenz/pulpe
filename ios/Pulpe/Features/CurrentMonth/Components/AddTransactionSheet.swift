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
    @State private var quickAmountTrigger = false

    private let transactionService = TransactionService.shared
    private let quickAmounts = DesignTokens.AmountInput.quickAmounts

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

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Formatters.amountInput.string(from: amount as NSDecimalNumber) ?? "0"
        }
        return "0.00"
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    KindToggle(selection: $kind)
                    heroAmountSection
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
            .navigationTitle(kind.newTransactionTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    SheetCloseButton()
                }
            }
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
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(DesignTokens.CornerRadius.xl)
        .presentationBackground(Color.surfacePrimary)
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

            // Subtle underline
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.hairline)
                .fill(isAmountFocused ? Color.pulpePrimary : Color.textTertiary.opacity(DesignTokens.Opacity.strong))
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isAmountFocused)

            if (amount ?? 0) == 0 {
                Text("Quel montant ?")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.lg)
        .contentShape(Rectangle())
        .onTapGesture { isAmountFocused = true }
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Montant")
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: amount)
    }

    // MARK: - Quick Amounts

    private var quickAmountChips: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(quickAmounts, id: \.self) { quickAmount in
                let isSelected = amount == Decimal(quickAmount)
                Button {
                    quickAmountTrigger.toggle()
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
                        .background(kind.color.opacity(isSelected ? 0.20 : 0.12))
                        .foregroundStyle(kind.color)
                        .clipShape(Capsule())
                        .overlay(Capsule().strokeBorder(kind.color.opacity(isSelected ? 0.40 : 0.20), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityHint("Définir le montant à \(quickAmount) CHF")
            }
        }
        .sensoryFeedback(.selection, trigger: quickAmountTrigger)
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
    }

    // MARK: - Description

    private var descriptionField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Description")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
            TextField(kind.descriptionPlaceholder, text: $name)
                .font(PulpeTypography.bodyLarge)
                .padding(DesignTokens.Spacing.lg)
                .background(Color.inputBackgroundSoft)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .accessibilityLabel("Description de la transaction")
        }
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Date")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
            HStack {
                DatePicker("", selection: $transactionDate, displayedComponents: .date)
                    .labelsHidden()
                    .datePickerStyle(.compact)
                    .accessibilityLabel("Date de la transaction")
                Spacer()
            }
            .padding(DesignTokens.Spacing.lg)
            .background(Color.inputBackgroundSoft)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
        }
    }

    // MARK: - Add Button

    private var addButton: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button { Task { await addTransaction() } } label: {
                Text("Ajouter")
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)

            if let hint = validationHint {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: validationHint)
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

// MARK: - Deep Link Wrapper

struct DeepLinkAddExpenseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = DeepLinkAddExpenseViewModel()

    var body: some View {
        Group {
            if let budgetId = viewModel.currentBudgetId {
                AddTransactionSheet(budgetId: budgetId) { _ in
                    dismiss()
                }
            } else {
                NavigationStack {
                    Group {
                        if viewModel.isLoading {
                            LoadingView(message: "Chargement...")
                        } else if let error = viewModel.error {
                            ContentUnavailableView {
                                Label("Erreur de connexion", systemImage: "wifi.exclamationmark")
                            } description: {
                                Text(DomainErrorLocalizer.localize(error))
                            } actions: {
                                Button("Réessayer") {
                                    Task { await viewModel.loadCurrentBudget() }
                                }
                                .buttonStyle(.bordered)
                            }
                        } else {
                            ContentUnavailableView(
                                "Pas encore de budget",
                                systemImage: "calendar.badge.exclamationmark",
                                description: Text("Crée d'abord un budget pour ce mois")
                            )
                        }
                    }
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Fermer") { dismiss() }
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadCurrentBudget()
        }
    }
}

@Observable @MainActor
final class DeepLinkAddExpenseViewModel {
    private(set) var currentBudgetId: String?
    private(set) var isLoading = true
    private(set) var error: Error?

    func loadCurrentBudget() async {
        isLoading = true
        error = nil
        do {
            let budget = try await BudgetService.shared.getCurrentMonthBudget()
            currentBudgetId = budget?.id
        } catch {
            self.error = error
            currentBudgetId = nil
        }
        isLoading = false
    }
}
