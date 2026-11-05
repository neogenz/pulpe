import SwiftUI

/// « À faire » (V2): what asks for a gesture, in at most three rows. Movements to point, the
/// prévisions that ran past their plan, the month that just closed. Renders nothing when
/// there is nothing to do, so the page does not spend a heading on an empty card.
struct HomeTodoCard: View {
    let onPoint: () -> Void
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
                            subtitle: HomeTodoPresentation.toPointSubtitle(names: unchecked.map(\.name)),
                            action: onPoint
                        )
                        .accessibilityIdentifier("homeTodoToPoint")
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
                .pulpeSurfaceCard()
            }
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
