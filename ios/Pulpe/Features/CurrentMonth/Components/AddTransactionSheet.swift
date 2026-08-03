import SwiftUI

/// Sheet for adding a new transaction — fintech-inspired hero amount layout
struct AddTransactionSheet: View {
    /// Whether an income is funded by a savings goal (PUL-329), and what that
    /// implies for the form. A value type so the rule can be tested on its own.
    struct SavingsGoalOrigin: Equatable {
        let kind: TransactionKind
        let isEnabled: Bool
        let goalId: String?
        let isWithdrawalReady: Bool

        /// Only an income can come out of a goal.
        var isOffered: Bool { kind == .income }

        var isActive: Bool { isOffered && isEnabled }

        /// The id sent on creation — never sent for a kind that cannot carry one.
        var sourceSavingsGoalId: String? { isActive ? goalId : nil }

        var blocksSubmission: Bool { isActive && !isWithdrawalReady }
    }

    let budgetId: String
    let onAdd: (Transaction) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @State private var name = ""
    @State private var amount: Decimal?
    @State private var kind: TransactionKind = .expense
    @State private var transactionDate = Date()
    @State private var isChecked = true
    @State private var isLoading = false
    @State private var error: Error?
    @FocusState private var focusedField: AmountDescriptionField?
    @State private var amountText = ""
    @State private var submitSuccessTrigger = false
    @State private var inputCurrency: SupportedCurrency = .chf
    @State private var selectedTagIds: Set<String> = []
    /// PUL-329 — an income can be funded by a savings goal. Off by default; the
    /// whole block disappears (and the choice is dropped) for any other kind.
    @State private var isFromSavingsGoal = false
    @State private var savingsGoalId: String?
    @State private var isWithdrawalReady = false
    @State private var withdrawalRefreshToken = 0
    /// The amount in the account currency — what the backend actually withdraws.
    @State private var convertedAmount: Decimal?

    private let dependencies: AddTransactionDependencies
    private let conversionService = CurrencyConversionService.shared

    init(
        budgetId: String,
        dependencies: AddTransactionDependencies = .live,
        onAdd: @escaping (Transaction) -> Void
    ) {
        self.budgetId = budgetId
        self.dependencies = dependencies
        self.onAdd = onAdd
    }

    private var savingsGoalOrigin: SavingsGoalOrigin {
        SavingsGoalOrigin(
            kind: kind,
            isEnabled: isFromSavingsGoal,
            goalId: savingsGoalId,
            isWithdrawalReady: isWithdrawalReady
        )
    }

    private var canSubmit: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty &&
        (amount ?? 0) > 0 &&
        !isLoading &&
        !savingsGoalOrigin.blocksSubmission
    }

    private var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    private var validationHint: String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return "Ajoute un montant" }
        if name.trimmingCharacters(in: .whitespaces).isEmpty { return "Ajoute une description" }
        // The picker states why a chosen goal is refused; only its absence needs
        // to be said here.
        if isFromSavingsGoal, savingsGoalId == nil { return "Choisis l'objectif utilisé" }
        return nil
    }

    var body: some View {
        SheetFormContainer(
            title: kind.newTransactionTitle,
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            Text("Pas liée à une prévision")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)

            KindToggle(selection: $kind)
            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: "Quel montant ?",
                currency: inputCurrency,
                accentColor: kind.color
            )
            QuickAmountChips(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                amountField: .amount,
                color: kind.color,
                currency: inputCurrency
            )
            .animation(.snappy(duration: DesignTokens.Animation.fast), value: kind)
            descriptionField
            dateSelector
            CheckedToggle(isOn: $isChecked, tintColor: kind.color)
            TagPickerField(selection: $selectedTagIds)
            savingsGoalOriginSection

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                    self.error = nil
                }
            }

            addButton
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear { inputCurrency = userSettingsStore.currency }
        .onChange(of: kind) { _, newKind in
            guard newKind != .income else { return }
            isFromSavingsGoal = false
            savingsGoalId = nil
        }
        .task(id: ConversionKey(amount: amount, inputCurrency: inputCurrency)) {
            await refreshConvertedAmount()
        }
        // Covers every presenter (FAB "+", widget deep link) in one place —
        // tips must not render on top of this sheet.
        .suppressesTips()
    }

    // MARK: - Description

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: "Description",
            accessibilityLabel: "Description de la transaction",
            focusBinding: $focusedField,
            field: .description
        )
    }

    // MARK: - Savings-goal origin (PUL-329)

    @ViewBuilder
    private var savingsGoalOriginSection: some View {
        if savingsGoalOrigin.isOffered {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Toggle("Ce revenu vient d'un objectif d'épargne", isOn: $isFromSavingsGoal)
                    .font(PulpeTypography.body)
                    .tint(kind.color)

                if isFromSavingsGoal {
                    Text("Le montant sera retiré de l'objectif choisi.")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)

                    SavingsGoalPickerField(
                        selection: $savingsGoalId,
                        mode: .withdrawal,
                        withdrawalAmount: convertedAmount,
                        withdrawalRefreshToken: withdrawalRefreshToken,
                        onWithdrawalReadinessChange: { isWithdrawalReady = $0 }
                    )
                }
            }
            .animation(DesignTokens.Animation.smoothEaseInOut, value: isFromSavingsGoal)
        }
    }

    // MARK: - Date Selector

    private var dateSelector: some View {
        TransactionDateSelector(date: $transactionDate, currency: userSettingsStore.currency)
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
        .animation(DesignTokens.Animation.smoothEaseInOut, value: validationHint)
    }

    // MARK: - Logic

    /// Keeps the withdrawal preview on the amount the backend will actually take
    /// out. The rate is cached for a day, so retyping does not hit the network.
    private func refreshConvertedAmount() async {
        guard let amount, amount > 0 else {
            convertedAmount = nil
            return
        }
        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            convertedAmount = conversion?.convertedAmount ?? amount
        } catch {
            // No rate, no trustworthy comparison — the picker stays blocked.
            convertedAmount = nil
        }
    }

    private func addTransaction() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )

            let data = TransactionCreate(
                budgetId: budgetId,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                transactionDate: transactionDate,
                checkedAt: isChecked ? Date() : nil,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate,
                tagIds: TagPickerField.createdTagIds(from: selectedTagIds),
                sourceSavingsGoalId: savingsGoalOrigin.sourceSavingsGoalId
            )

            let transaction = try await dependencies.createTransaction(data)
            if data.sourceSavingsGoalId != nil { savingsGoalStore.invalidateCache() }
            AnalyticsService.shared.capture(.transactionCreated, properties: ["type": kind.rawValue])
            submitSuccessTrigger.toggle()
            onAdd(transaction)
            toastManager.show("Transaction ajoutée")
            dismiss()
        } catch {
            self.error = error
            // A refused balance is provably stale: re-read the options in place,
            // keeping every input so the user only re-confirms.
            if let apiError = error as? APIError, apiError.requiresWithdrawalOptionsRefresh {
                withdrawalRefreshToken += 1
            }
        }
    }
}

/// Identity of a conversion request — a new value restarts the preview task.
private struct ConversionKey: Equatable {
    let amount: Decimal?
    let inputCurrency: SupportedCurrency
}

struct AddTransactionDependencies: Sendable {
    var createTransaction: @Sendable (TransactionCreate) async throws -> Transaction

    static let live = AddTransactionDependencies(
        createTransaction: { data in
            try await TransactionService.shared.createTransaction(data)
        }
    )
}

#Preview {
    AddTransactionSheet(budgetId: "test") { transaction in
        print("Added: \(transaction)")
    }
    .environment(ToastManager())
    .environment(TagStore())
    .environment(SavingsGoalStore())
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
