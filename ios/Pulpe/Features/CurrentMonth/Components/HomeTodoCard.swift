import SwiftUI

/// « À faire » (V2): what asks for a gesture. What is left to point, with the likeliest few
/// pointable right here, the prévisions that ran past their plan, the month that just closed.
/// Renders nothing when there is nothing to do, so the page does not spend a heading on an
/// empty card.
struct HomeTodoCard: View {
    let onPoint: () -> Void
    let onPointItem: (CurrentMonthStore.CheckableItem) -> Void
    let onOpenItem: (CurrentMonthStore.CheckableItem) -> Void
    let onCatchUp: () -> Void

    @Environment(AppState.self) private var appState
    @Environment(CurrentMonthStore.self) private var store
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// What the recap sheet was closed with, applied once it is gone: hiding the row while
    /// its sheet is still up would take the sheet's presenter away mid-animation.
    private enum SheetOutcome {
        case acknowledged(MonthRecap)
        case showDetails(budgetId: String)
    }

    /// How many of the likeliest items to point the card offers, in the store's order (learned
    /// pointing days first); the rest wait on « À pointer ».
    private static let suggestionCount = 3

    private let flags = MonthRecapFlagsStore()
    @State private var dismissedKey: String? = MonthRecapFlagsStore().lastSeenMonthRecap
    @State private var presentedRecap: MonthRecap?
    @State private var sheetOutcome: SheetOutcome?

    private var visibleRecap: MonthRecap? {
        guard let budget = store.budget,
              let recap = MonthRecap(closingBefore: budget, among: budgetListStore.budgets, metrics: store.metrics),
              recap.key != dismissedKey
        else { return nil }
        return recap
    }

    var body: some View {
        let unchecked = store.allUncheckedItems
        let uncheckedMovements = store.transactions.count { !$0.isChecked }
        let drifts = store.driftLines
        let recap = visibleRecap
        if !unchecked.isEmpty || !drifts.isEmpty || recap != nil {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("À faire")
                    .font(PulpeTypography.sectionTitle)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                    .padding(.horizontal, DesignTokens.Spacing.xs)

                VStack(spacing: DesignTokens.Spacing.none) {
                    if !unchecked.isEmpty {
                        TodoRow(
                            systemImage: "checkmark.circle",
                            title: HomeTodoPresentation.toPointTitle(
                                count: store.uncheckedCount,
                                includesForecasts: store.uncheckedCount > uncheckedMovements
                            ),
                            subtitle: AppLocale.string("Pointe ce qui est déjà passé sur ton compte."),
                            action: onPoint
                        )
                        .accessibilityIdentifier("homeTodoToPoint")
                        ForEach(unchecked.prefix(Self.suggestionCount)) { item in
                            divider(after: true)
                            suggestionRow(item)
                                .transition(.opacity)
                        }
                    }
                    if !drifts.isEmpty {
                        divider(after: !unchecked.isEmpty)
                        TodoRow(
                            systemImage: "chart.line.uptrend.xyaxis",
                            tone: .warning,
                            title: HomeTodoPresentation.driftTitle(names: drifts.map(\.line.name)),
                            subtitle: HomeTodoPresentation.driftSubtitle(
                                total: store.driftTotal, currency: userSettingsStore.currency
                            ),
                            blursSubtitle: true,
                            action: onCatchUp
                        )
                        .accessibilityIdentifier("homeTodoDrift")
                    }
                    if let recap {
                        divider(after: !unchecked.isEmpty || !drifts.isEmpty)
                        TodoRow(
                            systemImage: "calendar.badge.checkmark",
                            title: AppLocale.string("\(Formatters.monthName(for: recap.month)) est terminé"),
                            subtitle: HomeTodoPresentation.recapSubtitle(recap, currency: userSettingsStore.currency),
                            blursSubtitle: true,
                            action: { presentedRecap = recap }
                        )
                        .accessibilityIdentifier("homeTodoRecap")
                    }
                }
                .animation(
                    reduceMotion ? nil : DesignTokens.Animation.smoothEaseInOut,
                    value: unchecked.prefix(Self.suggestionCount).map(\.id)
                )
                .pulpeSurfaceCard()
            }
            // `.contain` first: a bare identifier on the card overwrites every row's own.
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("homeTodoCard")
            .sheet(item: $presentedRecap, onDismiss: settleSheet) { recap in
                MonthRecapSheet(
                    recap: recap,
                    onShowDetails: { sheetOutcome = .showDetails(budgetId: recap.budgetId) },
                    onAcknowledge: { sheetOutcome = .acknowledged(recap) }
                )
            }
        }
    }

    /// How far the point circle's 44pt column runs past a row's disc on each side.
    private var discOverhang: CGFloat { (DesignTokens.TapTarget.minimum - DesignTokens.TodoRow.disc) / 2 }

    private func suggestionRow(_ item: CurrentMonthStore.CheckableItem) -> some View {
        let currency = userSettingsStore.currency
        let subtitle: String
        var isOverrun = false
        var subtitleHasAmount = false
        let amount: Decimal
        let isSyncing: Bool
        switch item {
        case .transaction(let transaction, _):
            subtitle = ToPointPresentation.movementFact(
                for: transaction,
                lineName: transaction.budgetLineId.flatMap { id in store.budgetLines.first { $0.id == id }?.name },
                pointedNow: false
            )
            amount = transaction.amount
            isSyncing = store.syncingTransactionIds.contains(transaction.id)
        case .budgetLine(let line, let consumption):
            let fact = ToPointPresentation.lineFact(
                for: line,
                consumption: consumption
                    ?? BudgetFormulas.calculateConsumption(for: line, transactions: store.transactions),
                currency: currency
            )
            subtitle = fact.text
            isOverrun = fact.isOverrun
            subtitleHasAmount = fact.hasAmount
            amount = line.amount
            isSyncing = store.syncingBudgetLineIds.contains(line.id)
        }
        return PointRow(
            id: item.id,
            title: item.name,
            subtitle: subtitle,
            isOverrun: isOverrun,
            subtitleHasAmount: subtitleHasAmount,
            amount: amount.asAmount(for: currency),
            isPointed: false,
            isSyncing: isSyncing,
            // The circle centred on the discs of the rows around it, the text on their titles.
            leadingInset: DesignTokens.Spacing.lg - discOverhang,
            textGap: DesignTokens.Spacing.md - discOverhang,
            onToggle: { onPointItem(item) },
            onOpen: { onOpenItem(item) }
        )
    }

    @ViewBuilder
    private func divider(after hasRowAbove: Bool) -> some View {
        if hasRowAbove {
            Divider()
                .overlay(Color.outlineVariant)
                .padding(.leading, DesignTokens.ListRow.dividerInset + DesignTokens.Spacing.md)
        }
    }

    private func settleSheet() {
        defer { sheetOutcome = nil }
        switch sheetOutcome {
        case .acknowledged(let recap):
            flags.setLastSeenMonthRecap(recap.key)
            if reduceMotion {
                dismissedKey = recap.key
            } else {
                withAnimation(DesignTokens.Animation.smoothEaseOut) { dismissedKey = recap.key }
            }
        case .showDetails(let budgetId):
            appState.pushOnActiveStack(BudgetDestination.details(budgetId: budgetId))
        case nil:
            break
        }
    }
}
