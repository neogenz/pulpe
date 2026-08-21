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
        /// The typed amount could not be converted into the account currency, so
        /// there is nothing to weigh the goal's balance against (RG-009).
        let hasConversionFailed: Bool

        /// Only an income can come out of a goal.
        var isOffered: Bool { kind == .income }

        var isActive: Bool { isOffered && isEnabled }

        /// The id sent on creation — never sent for a kind that cannot carry one.
        var sourceSavingsGoalId: String? { isActive ? goalId : nil }

        var blocksSubmission: Bool { isActive && !isWithdrawalReady }

        /// Why this block holds the submission back, when the reason is its own.
        /// A chosen goal that the picker refuses states itself down there; what
        /// the picker cannot see is that it was never handed an amount to judge.
        var blockingReason: String? {
            guard isActive else { return nil }
            if goalId == nil { return AppLocale.string("Choisis l'objectif utilisé") }
            if hasConversionFailed {
                return AppLocale.string("Le taux de change est indisponible, réessaie dans un instant.")
            }
            return nil
        }
    }

    /// What the details card starts with when nothing is touched: the fact is dated
    /// today and has already left the account. Explicit so the defaults are tested.
    enum Defaults {
        static let isChecked = true
        static func transactionDate(now: Date = Date()) -> Date { now }
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
    @State private var transactionDate = Defaults.transactionDate()
    @State private var isChecked = Defaults.isChecked
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
    /// Set only once a conversion has been attempted and refused. `convertedAmount`
    /// alone cannot say it: it is equally nil while the rate is still in flight.
    @State private var hasConversionFailed = false

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
            isWithdrawalReady: isWithdrawalReady,
            hasConversionFailed: hasConversionFailed
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
        if (amount ?? 0) <= 0 { return AppLocale.string("Ajoute un montant") }
        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            return AppLocale.string("Ajoute une description")
        }
        return savingsGoalOrigin.blockingReason
    }

    var body: some View {
        SheetFormContainer(
            title: kind.newTransactionTitle,
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            KindToggle(selection: $kind)
            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: AppLocale.string("Quel montant ?"),
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

            // Three blocks: the amount above, what it is, then the details.
            FormCard {
                descriptionField
                FormRowDivider()
                TagPickerField(selection: $selectedTagIds, style: .row)
            }

            // The date is a detail, today by default.
            FormCard {
                TransactionDateSelector(date: $transactionDate, currency: userSettingsStore.currency, style: .row)
                FormRowDivider()
                CheckedToggle(isOn: $isChecked, tintColor: kind.color, style: .row)
                savingsGoalOriginSection
            }

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
            label: AppLocale.string("Description"),
            focusBinding: $focusedField,
            field: .description,
            style: .row
        )
    }

    // MARK: - Savings-goal origin (PUL-329)

    @ViewBuilder
    private var savingsGoalOriginSection: some View {
        if savingsGoalOrigin.isOffered {
            FormRowDivider()
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Toggle("Ce revenu vient d'un objectif d'épargne", isOn: $isFromSavingsGoal)
                    .font(PulpeTypography.body)
                    .tint(kind.color)
                    .frame(minHeight: DesignTokens.ListRow.minHeight)

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
            .padding(.bottom, isFromSavingsGoal ? DesignTokens.Spacing.lg : 0)
            .animation(DesignTokens.Animation.smoothEaseInOut, value: isFromSavingsGoal)
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
            .accessibilityIdentifier("addTransactionSubmit")

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
            hasConversionFailed = false
            return
        }
        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            convertedAmount = conversion?.convertedAmount ?? amount
            hasConversionFailed = false
        } catch {
            // No rate, no trustworthy comparison — the picker stays blocked, and
            // now says so instead of leaving a dead button.
            convertedAmount = nil
            hasConversionFailed = true
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
            if data.sourceSavingsGoalId != nil {
                savingsGoalStore.invalidateFromBudgetMutation()
            }
            AnalyticsService.shared.capture(.transactionCreated, properties: ["type": kind.rawValue])
            submitSuccessTrigger.toggle()
            onAdd(transaction)
            toastManager.show(AppLocale.string("Enregistré"))
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
                            LoadingView(message: AppLocale.string("Chargement..."))
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
