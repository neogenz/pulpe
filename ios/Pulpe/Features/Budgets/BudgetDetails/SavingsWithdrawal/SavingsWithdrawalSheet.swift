import SwiftUI

/// "Couvrir avec mon épargne" (PUL-292, V2 board 16): one screen. The amount the month
/// lacks as the hero, where the money comes from, the two-month couple it sets up (M / M+1)
/// and its impact on M's disponible. Submit freezes the FX (RG-009) and replays one
/// idempotency key on retry, then hands the confirmed income line back through `onAdd`.
/// It never debits a goal: « Prendre sur un objectif » hands over to the real goal withdrawal.
struct SavingsWithdrawalSheet: View {
    let prefill: SavingsWithdrawalPrefill
    /// M as the disponible reads it, for the impact block. `nil` hides the block.
    var ledger: MonthLedger?
    /// « Plutôt lisser »: M's largest spreadable dépense, offered instead of the withdrawal.
    var spreadInstead: SpreadExistingSource?
    var onSpreadInstead: (SpreadExistingSource) -> Void = { _ in }
    /// « Prendre sur un objectif »: hands the typed amount and currency to the goal withdrawal.
    var onTakeFromGoal: (Decimal?, SupportedCurrency) -> Void = { _, _ in }
    let onAdd: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore

    @State private var amount: Decimal?
    @State private var amountText: String
    /// The income's name sent to the server: the name typed before « À remettre », else « Mon épargne ».
    private let source: String
    @State private var inputCurrency: SupportedCurrency = .chf
    @State private var isSubmitting = false
    /// Stays false until the goals that can fund the withdrawal are known.
    @State private var hasGoalToDrawFrom = false
    @State private var submitSuccessTrigger = false
    @FocusState private var focusedField: Field?
    /// Idempotency key minted ONCE per presentation (= per create intent) and
    /// replayed on every submit retry so a double-tap or a post-failure retry
    /// replays the couple instead of duplicating it. `.sheet(item:)` rebuilds
    /// this view per presentation, so a fresh intent always gets a fresh key.
    @State private var groupId = UUID().uuidString.lowercased()

    private let dependencies: SavingsWithdrawalDependencies
    private let conversionService = CurrencyConversionService.shared

    private enum Field: Hashable { case amount }

    init(
        prefill: SavingsWithdrawalPrefill,
        ledger: MonthLedger? = nil,
        spreadInstead: SpreadExistingSource? = nil,
        dependencies: SavingsWithdrawalDependencies = .live,
        onSpreadInstead: @escaping (SpreadExistingSource) -> Void = { _ in },
        onTakeFromGoal: @escaping (Decimal?, SupportedCurrency) -> Void = { _, _ in },
        onAdd: @escaping (BudgetLine) -> Void
    ) {
        self.prefill = prefill
        self.ledger = ledger
        self.spreadInstead = spreadInstead
        self.dependencies = dependencies
        self.onSpreadInstead = onSpreadInstead
        self.onTakeFromGoal = onTakeFromGoal
        self.onAdd = onAdd
        let initial = prefill.amount ?? prefill.missingAmount
        self._amount = State(initialValue: initial)
        self._amountText = State(initialValue: initial.map(Self.plainString) ?? "")
        self.source = prefill.source ?? AppLocale.string("Mon épargne")
        self._inputCurrency = State(initialValue: prefill.inputCurrency ?? .chf)
    }

    /// « Prendre sur un objectif » needs a goal with money in it, and a Réel to write (not a prévision).
    static func offersGoalWithdrawal(options: [SavingsGoalWithdrawalOption], isFromForecast: Bool) -> Bool {
        !isFromForecast && options.contains { $0.availableAmount > 0 }
    }

    // MARK: - Derived months (anchored on the viewed month M)

    private var monthM: SpreadMonth {
        SpreadMonth(year: prefill.anchorYear, month: prefill.anchorMonth)
    }

    private var monthNext: SpreadMonth {
        SpreadMonth.from(ordinal: monthM.ordinal + 1)
    }

    private var monthInText: String { Formatters.monthNameInText(for: monthM.month) }

    private var typedAmount: Decimal { amount ?? 0 }

    private var canSubmit: Bool { typedAmount > 0 && !isSubmitting }

    /// The withdrawal lands as an income in M. Only judged in the account currency: a
    /// foreign amount has no rate until submit.
    private var impact: MovementImpact? {
        guard let ledger, typedAmount > 0, inputCurrency == userSettingsStore.currency else { return nil }
        return .forecast(ledger: ledger, budgetId: prefill.budgetId, kind: .income, amount: typedAmount)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    if userSettingsStore.showCurrencySelector {
                        CurrencyAmountPicker(selectedCurrency: $inputCurrency)
                    }
                    amountHero
                    sourceCard
                    planCard
                    if let impact {
                        ImpactBlock(
                            title: AppLocale.string("Ton disponible de \(monthInText)"),
                            impact: impact,
                            currency: userSettingsStore.currency
                        )
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .pulpeBackground()
            .pulpeStickyBottomCTA { ctaStack }
            .localizedNavigationTitle("Couvrir avec mon épargne")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton().disabled(isSubmitting)
                }
            }
        }
        .standardSheetPresentation(detents: [.large])
        .loadingOverlay(isSubmitting, message: AppLocale.string("On met ça en place…"))
        // Block swipe-to-dismiss while the couple is created server-side so the
        // sheet can't tear down mid-request (parity with SpreadExistingSheet).
        .interactiveDismissDisabled(isSubmitting)
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
        .task {
            // Preserve the currency the amount was typed in on the toggle path;
            // fall back to the user's setting on the card path (PUL-292).
            let seed = prefill.inputCurrency ?? userSettingsStore.currency
            if inputCurrency != seed { inputCurrency = seed }
            let options = (try? await savingsGoalStore.fetchWithdrawalOptions()) ?? []
            hasGoalToDrawFrom = Self.offersGoalWithdrawal(options: options, isFromForecast: prefill.isFromForecast)
        }
    }

    // MARK: - Hero

    private var amountHero: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text("Il te manque en \(monthInText)")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            HeroAmountField(
                amount: $amount,
                amountText: $amountText,
                focus: $focusedField,
                field: .amount,
                hint: AppLocale.string("Combien te manque-t-il ?"),
                currency: inputCurrency,
                caption: spreadInstead.map {
                    AppLocale.string("\($0.name), \($0.total.asAmount(for: userSettingsStore.currency)), passe ce mois")
                }
            )
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - D'où vient l'argent ?

    private var sourceCard: some View {
        FormCard(title: "D'où vient l'argent ?") {
            PulpeListRow(title: AppLocale.string("Mon épargne"), showsChevron: false) {
                Image(systemName: "checkmark")
                    .foregroundStyle(Color.accentInk)
                    .accessibilityHidden(true)
            }
            if hasGoalToDrawFrom {
                FormRowDivider()
                Button { onTakeFromGoal(amount, inputCurrency) } label: {
                    PulpeListRow(
                        title: AppLocale.string("Prendre sur un objectif"),
                        subtitle: AppLocale.string("L'objectif baisse, rien à remettre")
                    ) { EmptyView() }
                    .contentShape(Rectangle())
                }
                .plainPressedButtonStyle()
                .disabled(isSubmitting)
            }
        }
    }

    // MARK: - Ce que je mets en place

    private var planCard: some View {
        FormCard(title: "Ce que je mets en place") {
            PulpeListRow(
                title: monthM.name,
                subtitle: AppLocale.string("Pris sur ton épargne"),
                showsChevron: false
            ) {
                Text(typedAmount.asSignedAmount(for: .income, in: inputCurrency)).sensitiveAmount()
            }
            FormRowDivider()
            PulpeListRow(
                title: monthNext.name,
                subtitle: AppLocale.string("À remettre sur ton épargne"),
                showsChevron: false
            ) {
                Text(typedAmount.asAmount(for: inputCurrency)).sensitiveAmount()
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - CTA

    private var ctaStack: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button {
                focusedField = nil
                Task { await submit() }
            } label: {
                Text(AppLocale.string("Couvrir \(typedAmount.asCurrency(inputCurrency))"))
            }
            .disabled(!canSubmit)
            .primaryButtonStyle(isEnabled: canSubmit)

            if let spreadInstead {
                Button(AppLocale.string("Plutôt lisser \(spreadInstead.name)")) {
                    onSpreadInstead(spreadInstead)
                }
                .textLinkButtonStyle()
                .disabled(isSubmitting)
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Submit

    private func submit() async {
        guard let amount, amount > 0, !isSubmitting else { return }
        isSubmitting = true
        defer { isSubmitting = false }

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            let data = SavingsWithdrawalCreate(
                budgetId: prefill.budgetId,
                amount: conversion?.convertedAmount ?? amount,
                incomeName: source,
                savingName: AppLocale.string("Remettre sur ton épargne"),
                groupId: groupId,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate
            )
            let response = try await dependencies.createSavingsWithdrawal(data)
            submitSuccessTrigger.toggle()
            onAdd(response.incomeLine)
            toastManager.show(AppLocale.string("C'est réglé pour ce mois"))
            dismiss()
        } catch {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
        }
    }

    /// Plain editable string for `HeroAmountField`'s text buffer (no grouping,
    /// dot decimal) — round-trips through `String.parsedAsAmount`.
    private static func plainString(_ value: Decimal) -> String {
        NSDecimalNumber(decimal: value).stringValue
    }
}

/// Injectable server seam so the create call can be stubbed in tests — mirrors
/// `AddBudgetLineDependencies`.
struct SavingsWithdrawalDependencies: Sendable {
    var createSavingsWithdrawal: @Sendable (SavingsWithdrawalCreate) async throws -> SavingsWithdrawalResponse

    static let live = SavingsWithdrawalDependencies(
        createSavingsWithdrawal: { data in
            try await BudgetLineService.shared.createSavingsWithdrawal(data)
        }
    )
}

#Preview {
    SavingsWithdrawalSheet(
        prefill: SavingsWithdrawalPrefill(
            budgetId: "test",
            anchorMonth: 6,
            anchorYear: 2026,
            missingAmount: 320
        )
    ) { _ in }
    .environment(ToastManager())
    .environment(UserSettingsStore())
    .environment(SavingsGoalStore())
}
