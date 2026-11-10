import SwiftUI

/// A goal withdrawal the sheet opens on: a revenu drawn from savings, origin « objectif », with
/// the goal and the amount already chosen when known.
struct GoalWithdrawalStart: Hashable {
    var goalId: String?
    var amount: Decimal?
    var currency: SupportedCurrency?
    /// The description typed before the handover, so goal mode does not ask for it again.
    var name: String?
}

/// The one sheet that writes a movement: "Nouvelle dépense / Nouveau revenu / Nouvelle
/// épargne", the same sheet with its prévision already chosen ("Noter un montant" on a
/// prévision), and "Modifier" for an existing one. It asks one question, "C'était prévu
/// dans ton budget ?", and shows what the answer does to the disponible before it is saved.
struct MovementSheet: View {
    /// What the card starts with when nothing is touched: the fact is dated today and has
    /// already left the account. Explicit so the defaults are tested.
    enum Defaults {
        static let isChecked = true
        static func transactionDate(now: Date = Date()) -> Date { now }
    }

    /// An answer the user gave to "C'était prévu ?", as opposed to the suggested one.
    enum LinePick: Equatable {
        case line(String)
        case unplanned
    }

    let context: MovementSheetContext
    let editActions: MovementSheetEditActions?
    let onAdd: (Transaction) -> Void
    /// « À remettre »: amount, currency and source to hand to the withdrawal flow.
    /// `nil` where that flow is out of reach (widget deep link) — the segment hides.
    let onRequestSavingsWithdrawal: ((Decimal, SupportedCurrency, String?) -> Void)?
    /// Opens "Nouvelle prévision" once this sheet is gone. `nil` hides the link.
    let onRequestNewForecast: (() -> Void)?

    @Environment(\.dismiss) var dismiss
    @Environment(\.accessibilityReduceMotion) var reduceMotion
    @Environment(ToastManager.self) var toastManager
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(SavingsGoalStore.self) var savingsGoalStore
    @State var name: String
    @State var amount: Decimal?
    @State var amountText: String
    @State var kind: TransactionKind
    @State var transactionDate: Date
    @State var isChecked: Bool
    @State var isLoading = false
    @State var error: Error?
    @FocusState var focusedField: AmountDescriptionField?
    @State var submitSuccessTrigger = false
    @State var inputCurrency: SupportedCurrency
    @State var selectedTagIds: Set<String>
    @State var linePick: LinePick?
    @State var showsLinePicker = false
    @State var isConfirmingPostpone = false
    /// An income can come from savings: a goal (PUL-329) or « À remettre » (PUL-292). Off by
    /// default; the whole block disappears (and the choice is dropped) for any other kind.
    @State var isFromSavings = false
    @State var savingsOrigin: SavingsOrigin = .goal
    @State var savingsGoalId: String?
    @State var isWithdrawalReady = false
    @State var withdrawalRefreshToken = 0
    /// The amount in the account currency — what the backend actually books.
    @State var convertedAmount: Decimal?
    /// Set only once a conversion has been attempted and refused. `convertedAmount`
    /// alone cannot say it: it is equally nil while the rate is still in flight.
    @State var hasConversionFailed = false
    @State var didPrefillRealization = false
    /// The goal's confirmed balance behind an announced withdrawal, for the ceiling.
    @State var confirmedBalance: Decimal?

    let initialTagIds: Set<String>
    /// The currency typed before the handover to a goal withdrawal; kept over the account's.
    let startCurrency: SupportedCurrency?
    let dependencies: AddTransactionDependencies
    let conversionService = CurrencyConversionService.shared

    init(
        context: MovementSheetContext,
        editActions: MovementSheetEditActions? = nil,
        dependencies: AddTransactionDependencies = .live,
        userCurrency: SupportedCurrency = .chf,
        withdrawalStart: GoalWithdrawalStart? = nil,
        onRequestSavingsWithdrawal: ((Decimal, SupportedCurrency, String?) -> Void)? = nil,
        onRequestNewForecast: (() -> Void)? = nil,
        onAdd: @escaping (Transaction) -> Void = { _ in }
    ) {
        self.context = context
        self.editActions = editActions
        self.dependencies = dependencies
        self.onRequestSavingsWithdrawal = onRequestSavingsWithdrawal
        self.onRequestNewForecast = onRequestNewForecast
        self.onAdd = onAdd
        self.startCurrency = withdrawalStart?.currency

        if let tx = context.editing {
            let currency = EditTransactionLogic.shouldShowAlternateCurrency(for: tx, userCurrency: userCurrency)
                ? (tx.originalCurrency ?? userCurrency)
                : userCurrency
            let initial = EditTransactionLogic.initialAmount(for: tx, userCurrency: userCurrency)
            let tagIds = Set(tx.tagIds ?? [])
            _name = State(initialValue: tx.name)
            _amount = State(initialValue: initial)
            _amountText = State(initialValue: Formatters.amountInput(for: currency)
                .string(from: initial as NSDecimalNumber) ?? "")
            _kind = State(initialValue: tx.kind)
            _transactionDate = State(initialValue: tx.transactionDate)
            _isChecked = State(initialValue: tx.isChecked)
            _inputCurrency = State(initialValue: currency)
            _selectedTagIds = State(initialValue: tagIds)
            self.initialTagIds = tagIds
        } else {
            let line = context.preselectedLineId.flatMap { id in context.budgetLines.first { $0.id == id } }
            _name = State(initialValue: "")
            _amount = State(initialValue: nil)
            _amountText = State(initialValue: "")
            _kind = State(initialValue: line?.kind ?? .expense)
            _transactionDate = State(initialValue: Defaults.transactionDate())
            _isChecked = State(initialValue: Defaults.isChecked)
            _inputCurrency = State(initialValue: userCurrency)
            _selectedTagIds = State(initialValue: [])
            _linePick = State(initialValue: line.map { .line($0.id) })
            self.initialTagIds = []
            // « Faire un retrait » from a goal: a revenu drawn from that goal's savings.
            if let withdrawalStart {
                _kind = State(initialValue: .income)
                _isFromSavings = State(initialValue: true)
                _savingsOrigin = State(initialValue: .goal)
                _savingsGoalId = State(initialValue: withdrawalStart.goalId)
                if let startName = withdrawalStart.name { _name = State(initialValue: startName) }
                let currency = withdrawalStart.currency ?? userCurrency
                _inputCurrency = State(initialValue: currency)
                if let startAmount = withdrawalStart.amount {
                    _amount = State(initialValue: startAmount)
                    _amountText = State(initialValue: Formatters.amountInput(for: currency)
                        .string(from: startAmount as NSDecimalNumber) ?? "")
                }
            }
        }
    }

    // MARK: - Derived

    var isEditing: Bool { context.editing != nil }

    var title: String {
        isEditing ? AppLocale.string("Modifier") : kind.newTransactionTitle
    }

    var savingsOriginRule: SavingsOriginRule {
        SavingsOriginRule(
            kind: kind,
            isEnabled: !isEditing && isFromSavings,
            goalId: savingsGoalId,
            isWithdrawalReady: isWithdrawalReady,
            hasConversionFailed: hasConversionFailed,
            origin: savingsOrigin
        )
    }

    var routesToWithdrawal: Bool { savingsOriginRule.routesToWithdrawal }

    /// An announced withdrawal still to realize, when the sheet was opened on one.
    var realization: AddAllocatedTransactionLogic.RealizationPrefill? {
        guard !isEditing, let line = preselectedLine else { return nil }
        let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: context.transactions)
        return AddAllocatedTransactionLogic.realizationPrefill(for: line, consumption: consumption)
    }

    var preselectedLine: BudgetLine? {
        context.preselectedLineId.flatMap { id in context.budgetLines.first { $0.id == id } }
    }

    /// A saved movement keeps the kind of its prévision or goal; a realization is an income.
    var isKindLocked: Bool {
        if let tx = context.editing { return !EditTransactionLogic.isKindEditable(for: tx) }
        return realization != nil
    }

    var canSubmit: Bool {
        // The withdrawal names its source itself ("Mon épargne") when none is typed.
        (routesToWithdrawal || !name.trimmingCharacters(in: .whitespaces).isEmpty)
            && (amount ?? 0) > 0
            && !isLoading
            && !savingsOriginRule.blocksSubmission
    }

    var hasStartedFilling: Bool {
        (amount ?? 0) > 0 || !name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var validationHint: String? {
        guard !canSubmit, !isLoading, hasStartedFilling else { return nil }
        if (amount ?? 0) <= 0 { return AppLocale.string("Ajoute un montant") }
        if !routesToWithdrawal, name.trimmingCharacters(in: .whitespaces).isEmpty {
            return AppLocale.string("Ajoute une description")
        }
        return savingsOriginRule.blockingReason
    }

    // MARK: - Body

    var body: some View {
        SheetFormContainer(
            title: title,
            isLoading: isLoading,
            focus: $focusedField,
            focusOrder: [.amount, .description]
        ) {
            formContent
                .navigationDestination(isPresented: $showsLinePicker) { linePickerPage }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .onAppear { if !isEditing { inputCurrency = startCurrency ?? userSettingsStore.currency } }
        .onChange(of: kind) { _, newKind in
            if case .line(let id) = linePick,
               context.budgetLines.first(where: { $0.id == id })?.kind != newKind {
                linePick = nil
            }
            guard newKind != .income else { return }
            isFromSavings = false
            savingsOrigin = .goal
            savingsGoalId = nil
        }
        .task(id: ConversionKey(amount: amount, inputCurrency: inputCurrency)) {
            await refreshConvertedAmount()
        }
        .task { await prefillRealization() }
        // Covers every presenter (FAB "+", widget deep link) in one place —
        // tips must not render on top of this sheet.
        .suppressesTips()
    }

    private var formContent: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            if let realization { realizationHeader(realization) }
            if let source = context.editing?.savingsGoalSource {
                SavingsGoalSourceLabel(source: source)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            KindToggle(selection: $kind)
                .disabled(isKindLocked)

            if userSettingsStore.showCurrencySelector {
                CurrencyAmountPicker(selectedCurrency: $inputCurrency, isReadOnly: isEditing)
            }
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: AppLocale.string("Quel montant ?"),
                currency: inputCurrency
            )
            if let tx = context.editing {
                CurrencyConversionBadge(
                    originalAmount: tx.originalAmount,
                    originalCurrency: tx.originalCurrency,
                    exchangeRate: tx.exchangeRate
                )
            }

            descriptionField
            lineQuestion
            if !isEditing { savingsOriginCard }
            impactBlock
            detailsCard

            if let error {
                ErrorBanner(message: DomainErrorLocalizer.localize(error)) { self.error = nil }
            }

            if isEditing { editButtons }
            submitButton
            if !isEditing, !routesToWithdrawal, realization == nil, let onRequestNewForecast {
                Button(AppLocale.string("Réserver un montant pour plus tard")) {
                    dismiss()
                    onRequestNewForecast()
                }
                .tertiaryButtonStyle()
                .accessibilityIdentifier("movementReserveLink")
            }
        }
        // The impact, the savings card and the details come and go with the answers above them:
        // one curve for all, so the layout glides instead of stepping.
        .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: impact)
        .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: isFromSavings)
    }

    private var descriptionField: some View {
        FormTextField(
            hint: kind.descriptionPlaceholder,
            text: $name,
            label: nil,
            accessibilityLabel: AppLocale.string("Description"),
            focusBinding: $focusedField,
            field: .description,
            onSubmit: {
                guard canSubmit else { return }
                Task { await submit() }
            }
        )
    }
}

/// Identity of a conversion request — a new value restarts the preview task.
struct ConversionKey: Equatable {
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
