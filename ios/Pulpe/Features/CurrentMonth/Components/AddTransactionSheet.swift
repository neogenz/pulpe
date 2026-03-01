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
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false

    private let transactionService = TransactionService.shared

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
        SheetFormContainer(title: kind.newTransactionTitle, isLoading: isLoading, autoFocus: $isAmountFocused) {
            KindToggle(selection: $kind)
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                isFocused: $isAmountFocused,
                hint: "Quel montant ?",
                accentColor: kind.color
            )
            QuickAmountChips(amount: $amount, amountText: $amountText, isFocused: $isAmountFocused, color: kind.color)
                .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
            descriptionField
            dateSelector

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
                .accessibilityLabel("Description de la transaction")
        }
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text("Date")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)
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
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                    .strokeBorder(Color.outlineVariant.opacity(0.5), lineWidth: 1)
            )
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
            budgetId: budgetId,
            name: name.trimmingCharacters(in: .whitespaces),
            amount: amount,
            kind: kind,
            transactionDate: transactionDate
        )

        do {
            let transaction = try await transactionService.createTransaction(data)
            AnalyticsService.shared.capture(.transactionCreated, properties: ["type": kind.rawValue])
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
    .environment(ToastManager())
}

// MARK: - Deep Link Wrapper

struct DeepLinkAddExpenseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(UserSettingsStore.self) private var userSettingsStore
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
                                    Task {
                                        await viewModel.loadCurrentBudget(
                                            payDayOfMonth: userSettingsStore.payDayOfMonth
                                        )
                                    }
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
                            SheetCloseButton()
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadCurrentBudget(payDayOfMonth: userSettingsStore.payDayOfMonth)
        }
    }
}

@Observable @MainActor
final class DeepLinkAddExpenseViewModel {
    private(set) var currentBudgetId: String?
    private(set) var isLoading = true
    private(set) var error: Error?

    func loadCurrentBudget(payDayOfMonth: Int? = nil) async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            let budget = try await BudgetService.shared.getCurrentMonthBudget(payDayOfMonth: payDayOfMonth)
            currentBudgetId = budget?.id
        } catch {
            self.error = error
            currentBudgetId = nil
        }
    }
}
