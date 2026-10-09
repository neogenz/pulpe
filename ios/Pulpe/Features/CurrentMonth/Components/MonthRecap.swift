import Foundation

/// The month that just closed, read once the next one has opened (PUL-111). Same rule as
/// the webapp's `previousMonthRecap`: income and expenses come from the sparse budget
/// list, the carry-over and the new month's start from the current budget, whose
/// `rollover` is by definition where the closed month ended.
struct MonthRecap: Hashable, Identifiable, Sendable {
    enum Outcome: Sendable {
        case saved, overspent, balanced
    }

    let budgetId: String
    let month: Int
    let year: Int
    /// The month that opened after it — named in the carry-over sentence.
    let openedMonth: Int
    let income: Decimal
    /// Every outflow, savings included: the figure the month's result is defined against.
    let expenses: Decimal
    /// The month's own result (`ending_balance`): income − expenses, without the report
    /// it inherited.
    let endingBalance: Decimal
    let carriedOver: Decimal
    let startingAvailable: Decimal

    /// "YYYY-MM": the dismissal is stored per closed month.
    var key: String {
        String(format: "%04d-%02d", year, month)
    }

    var id: String { key }

    /// Judged on the whole franc the card prints, so it never reads "0 CHF de côté".
    var outcome: Outcome {
        let rounded = endingBalance.rounded(0)
        if rounded > 0 { return .saved }
        if rounded < 0 { return .overspent }
        return .balanced
    }
}

extension MonthRecap {
    /// The previous period of `current`, or `nil` when it has no budget — the user's
    /// first month included.
    init?(closingBefore current: Budget, among budgets: [BudgetSparse], metrics: BudgetFormulas.Metrics) {
        let previousMonth = current.month == 1 ? 12 : current.month - 1
        let previousYear = current.month == 1 ? current.year - 1 : current.year
        guard let closed = budgets.first(where: { $0.month == previousMonth && $0.year == previousYear }) else {
            return nil
        }
        let income = closed.totalIncome ?? 0
        let expenses = closed.totalExpenses ?? 0
        self.init(
            budgetId: closed.id,
            month: previousMonth,
            year: previousYear,
            openedMonth: current.month,
            income: income,
            expenses: expenses,
            endingBalance: income - expenses,
            carriedOver: metrics.rollover,
            startingAvailable: metrics.available
        )
    }
}
