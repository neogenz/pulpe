import SwiftUI

// MARK: - Savings withdrawal card (PUL-292)

/// The "mois un peu juste" card gating + rendering, split out of the main view
/// file (same precedent as `BudgetDetailsView+Routing.swift`). The members read
/// here (`projector`, `router`, `userSettingsStore`, `dismissedWithdrawalBudgetIds`)
/// are declared non-private on the view for this reason.
extension BudgetDetailsView {
    /// Origin month name (M) shown as a subtitle complement on the M+1
    /// "Remettre sur ton épargne" saving line — the viewed budget's month − 1.
    var savingsWithdrawalOriginMonthName: String? {
        guard let month = projector.screenState.hero.month else { return nil }
        return Formatters.monthName(for: BudgetLine.savingsWithdrawalOriginMonth(forBudgetMonth: month))
    }

    /// Non-nil prefill when the deficit card should surface for the viewed month
    /// (PUL-292, CA1/CA3): a current-or-future deficit, not dismissed for this
    /// budget — an existing withdrawal does not hide it. The card offers
    /// |available| via the sheet's quick-fill chip rather than imposing it.
    var tightMonthCardPrefill: SavingsWithdrawalPrefill? {
        let screenState = projector.screenState
        guard let month = screenState.hero.month, let year = screenState.hero.year else { return nil }

        let currentPeriod = BudgetPeriodCalculator.periodForDate(
            Date(),
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
        let isCurrentOrFutureMonth = BudgetPeriodCalculator.comparePeriods(
            BudgetPeriod(month: month, year: year),
            currentPeriod
        ) >= 0
        let isDismissed = SavingsWithdrawalCardGate.isDismissed(
            budgetId: screenState.budgetId,
            in: dismissedWithdrawalBudgetIds
        )
        let available = screenState.hero.metrics.available
        guard SavingsWithdrawalCardGate.shouldPresent(
            available: available,
            isCurrentOrFutureMonth: isCurrentOrFutureMonth,
            isDismissed: isDismissed
        ) else { return nil }

        return SavingsWithdrawalPrefill(
            budgetId: screenState.budgetId,
            anchorMonth: month,
            anchorYear: year,
            missingAmount: available.absoluteValue
        )
    }

    @ViewBuilder
    func tightMonthCard(prefill: SavingsWithdrawalPrefill) -> some View {
        TightMonthCard(
            onWithdraw: { router.present(.savingsWithdrawal(prefill)) },
            onDismiss: {
                dismissedWithdrawalBudgetIds = SavingsWithdrawalCardGate.appendingDismissal(
                    budgetId: prefill.budgetId,
                    to: dismissedWithdrawalBudgetIds
                )
            }
        )
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
    }
}
