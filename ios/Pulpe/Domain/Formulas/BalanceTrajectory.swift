import Foundation

extension BudgetFormulas {
    struct BalanceTrajectory: Equatable, Sendable {
        struct Point: Identifiable, Equatable, Sendable {
            let day: Int
            let balance: Decimal

            var id: Int { day }
        }

        let actual: [Point]
        let projected: [Point]
        let plannedBalance: Decimal
        let today: Int
        let totalDays: Int
    }

    /// Daily realized balance through today, then the forward projection used by the dashboard.
    static func calculateBalanceTrajectory(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        metrics: Metrics,
        projection: Projection,
        budget: Budget
    ) -> BalanceTrajectory? {
        let calendar = Calendar.current
        guard let monthStart = calendar.date(from: DateComponents(
            year: budget.year,
            month: budget.month,
            day: 1
        )) else { return nil }

        let totalDays = max(projection.daysElapsed + projection.daysRemaining, 1)
        let today = min(max(projection.daysElapsed, 1), totalDays)
        let actual = (0 ... today).compactMap { day -> BalanceTrajectory.Point? in
            guard day > 0 else {
                return .init(day: 0, balance: metrics.available)
            }
            guard let endExclusive = calendar.date(
                byAdding: .day,
                value: day,
                to: monthStart
            ) else { return nil }
            let realized = realizedExpenses(
                before: endExclusive,
                monthStart: monthStart,
                budgetLines: budgetLines,
                transactions: transactions
            )
            return .init(day: day, balance: metrics.available - realized)
        }

        guard let current = actual.last else { return nil }
        let projected = today < totalDays
            ? [current, .init(day: totalDays, balance: projection.projectedEndOfMonthBalance)]
            : []
        return BalanceTrajectory(
            actual: actual,
            projected: projected,
            plannedBalance: metrics.remaining,
            today: today,
            totalDays: totalDays
        )
    }

    private static func realizedExpenses(
        before endExclusive: Date,
        monthStart: Date,
        budgetLines: [BudgetLine],
        transactions: [Transaction]
    ) -> Decimal {
        let transactionsByLineId = Dictionary(
            grouping: transactions.filter {
                $0.isChecked
                    && $0.kind.isOutflow
                    && $0.transactionDate >= monthStart
                    && $0.transactionDate < endExclusive
            },
            by: { $0.budgetLineId ?? "" }
        )

        var total: Decimal = 0
        for line in budgetLines where line.kind.isOutflow && !(line.isRollover ?? false) {
            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0
            let wasChecked = line.checkedAt.map { $0 < endExclusive } ?? false
            total += wasChecked ? max(line.amount, consumed) : consumed
        }

        return total + (transactionsByLineId[""]?
            .reduce(Decimal.zero) { $0 + $1.amount } ?? 0)
    }
}
