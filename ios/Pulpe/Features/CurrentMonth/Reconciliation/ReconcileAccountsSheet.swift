import SwiftUI

/// What the sheet reads to check an item: the month's movements and prévisions and the caller's own
/// toggle, which reports whether the server took it.
struct ReconciliationChecking {
    let items: [CurrentMonthStore.CheckableItem]
    let transactions: [Transaction]
    let budgetLines: [BudgetLine]
    let syncingTransactionIds: Set<String>
    let syncingBudgetLineIds: Set<String>
    let toggle: @MainActor (CurrentMonthStore.CheckableItem) async -> Bool

    @MainActor
    func check(_ target: ReconcileAccountsFlow.Suggestion.Target) async -> Bool {
        switch target {
        case .transaction(let transaction): await toggle(.transaction(transaction))
        case .budgetLine(let line): await toggle(.budgetLine(line))
        }
    }

    /// Items a saving prévision of the month feeds: their balance follows from the month, so the
    /// add sheet never offers them. An expense prévision linked to an item does not hide it.
    var savingAssetIds: Set<String> {
        Set(budgetLines.filter { $0.kind == .saving }.compactMap(\.assetId))
    }
}

/// « Comparer avec mes comptes » (PUL-351, V2): one sheet. Step 1 takes the balances typed by the
/// user (`ReconcileAccountsStepView`); step 2 compares them with Pulpe and walks the gap to a check,
/// one noted « Écart avec mes comptes » or nothing (`ReconcileCompareStepView`). Every input lives in
/// `flow`, owned here, so closing discards it and writes nothing. Whatever is left unfinished goes to
/// `onLeave`, whose owner decides whether it outlives the sheet.
struct ReconcileAccountsSheet: View {
    /// The loaded month, read again on every render.
    struct Month {
        let budgetId: String
        let realizedMetrics: BudgetFormulas.RealizedMetrics
        /// « Disponible à dépenser » now.
        let available: Decimal
        /// A pointing not yet confirmed: its rollback would move the balance under a
        /// verdict already acted on, so the actions wait for it.
        var hasPointingInFlight = false
    }

    let month: Month
    let checking: ReconciliationChecking
    /// What the sheet leaves behind when it goes away: `nil` once finished.
    var onLeave: (@MainActor (ReconcileAccountsFlow.Draft?) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var flow: ReconcileAccountsFlow
    /// The guide page, shown instead of the form while set; `nil` shows the form.
    @State private var guideSource: ReconcileGuideSource?
    @AppStorage(ReconcileGuideGate.storageKey) private var hasSeenGuide = false

    init(
        month: Month,
        checking: ReconciliationChecking,
        dependencies: AddTransactionDependencies = .live,
        netWorthAccounts: [Asset]? = nil,
        freeAccounts: [ReconcileFreeAccountsStore.Entry] = ReconcileFreeAccountsStore.shared.entries,
        restoring draft: ReconcileAccountsFlow.Draft? = nil,
        onLeave: (@MainActor (ReconcileAccountsFlow.Draft?) -> Void)? = nil,
        onAdjustmentCreated: @escaping @MainActor (Transaction) -> Void
    ) {
        self.month = month
        self.checking = checking
        self.onLeave = onLeave
        let hasSeenGuide = UserDefaults.standard.bool(forKey: ReconcileGuideGate.storageKey)
        _guideSource = State(initialValue: ReconcileGuideGate.shouldPresent(hasSeen: hasSeenGuide) ? .auto : nil)
        _flow = State(initialValue: ReconcileAccountsFlow(
            budgetId: month.budgetId,
            entryName: AppLocale.string("Écart avec mes comptes"),
            createTransaction: dependencies.createTransaction,
            fetchContext: { try await ReconciliationService.shared.getContext(budgetId: $0) },
            updateState: { try await ReconciliationService.shared.updateState($0) },
            onAdjustmentCreated: onAdjustmentCreated,
            onCompleted: { completion in
                AnalyticsService.shared.capture(
                    .accountReconciliationCompleted,
                    properties: completion.analyticsProperties
                )
            },
            netWorthAccounts: netWorthAccounts,
            freeAccounts: freeAccounts,
            restoring: draft
        ))
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    @ViewBuilder private var currentStep: some View {
        switch flow.step {
        case .accounts:
            ReconcileAccountsStepView(
                flow: flow, currency: currency, fedAssetIds: checking.savingAssetIds
            )
        case .comparison:
            ReconcileCompareStepView(flow: flow, month: month, checking: checking, currency: currency)
        }
    }

    var body: some View {
        NavigationStack {
            if let guideSource {
                ReconcileGuideView(source: guideSource, currency: currency) { _ in
                    hasSeenGuide = true
                    self.guideSource = nil
                }
                // No bar title: the guide's own title says it, and « Passer » leaves no room for this long one
                .navigationBarTitleDisplayMode(.inline)
            } else {
                currentStep
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .principal) {
                            // Scaled, then wrapped: the long name never ends in an ellipsis.
                            Text("Comparer avec mes comptes")
                                .font(PulpeTypography.headline)
                                .multilineTextAlignment(.center)
                                .lineLimit(2)
                                .minimumScaleFactor(DesignTokens.TextScale.compact)
                                .accessibilityAddTraits(.isHeader)
                        }
                        ToolbarItem(placement: .cancellationAction) {
                            leadingButton.disabled(flow.isWriting || flow.isChecking)
                        }
                        ToolbarItem(placement: .topBarTrailing) {
                            Button { guideSource = .help } label: {
                                Image(systemName: "questionmark.circle")
                            }
                            .disabled(flow.isWriting || flow.isChecking)
                            .accessibilityLabel(AppLocale.string("Revoir le guide"))
                            .accessibilityIdentifier("reconcileGuideHelp")
                        }
                    }
            }
        }
        .standardSheetPresentation()
        // Nothing leaves the sheet while a write or a check is in flight, nor by a swipe once a balance is
        // typed: a swipe meant to lower the keyboard would throw them away. The close button still leaves.
        .interactiveDismissDisabled(flow.isWriting || flow.isChecking || flow.hasTypedBalance || guideSource == .help)
        .onChange(of: flow.shouldClose(loadedBudgetId: month.budgetId)) { _, shouldClose in
            if shouldClose { dismiss() }
        }
        .onDisappear { onLeave?(flow.draft) }
        .appliesAccountLinks(of: flow)
        .suppressesTips()
    }

    /// Step 1 closes the sheet; step 2 goes back to the balances.
    @ViewBuilder private var leadingButton: some View {
        if flow.step == .accounts {
            SheetCloseButton()
        } else {
            Button { flow.editAccounts() } label: { Image(systemName: "chevron.left") }
                .accessibilityLabel(AppLocale.string("Retour"))
                .accessibilityIdentifier("reconcileBackToAccounts")
        }
    }
}

#Preview("Comparer") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            ReconcileAccountsSheet(
                month: .init(
                    budgetId: "preview",
                    realizedMetrics: .init(
                        realizedIncome: 5200,
                        realizedExpenses: 2100.35,
                        realizedBalance: 3219.65,
                        checkedItemsCount: 12,
                        totalItemsCount: 18,
                        checkedSavingsAmount: 300
                    ),
                    available: 900
                ),
                checking: .init(
                    items: [], transactions: [], budgetLines: [],
                    syncingTransactionIds: [], syncingBudgetLineIds: [],
                    toggle: { _ in false }
                ),
                onAdjustmentCreated: { _ in }
            )
            .environment(ToastManager())
            .environment(UserSettingsStore())
            .environment(AssetStore())
            .environment(AppState())
        }
}
