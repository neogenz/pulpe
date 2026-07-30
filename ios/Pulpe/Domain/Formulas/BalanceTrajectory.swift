import Foundation

extension BudgetFormulas {
    struct BalanceTrajectory: Equatable, Sendable {
        struct Point: Identifiable, Equatable, Sendable {
            let day: Int
            let balance: Decimal

            var id: Int { day }
        }

        let tracked: [Point]
        let remainingPlan: [Point]
        let plannedBalance: Decimal
        let today: Int
        let totalDays: Int

        /// Nothing has been pointed yet on this period: every tracked day still carries the
        /// opening balance. The trajectory is a flat line, so the link to the estimated end
        /// would be a cliff drawn from no evidence.
        var hasNothingTracked: Bool {
            guard let opening = tracked.first else { return true }
            return tracked.allSatisfy { $0.balance == opening.balance }
        }
    }

    // swiftlint:disable function_parameter_count
    /// Budget left after pointed outflows through today, then a link to the full-plan destination.
    static func calculateBalanceTrajectory(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        metrics: Metrics,
        plannedBalance: Decimal,
        budget: Budget,
        payDayOfMonth: Int?,
        referenceDate: Date = Date()
    ) -> BalanceTrajectory? {
        let calendar = Calendar.current
        let period = BudgetPeriodCalculator.periodDates(
            month: budget.month,
            year: budget.year,
            payDayOfMonth: payDayOfMonth
        )
        let periodStart = calendar.startOfDay(for: period.startDate)
        let periodEnd = calendar.startOfDay(for: period.endDate)
        let referenceDay = calendar.startOfDay(for: referenceDate)
        guard referenceDay >= periodStart, referenceDay <= periodEnd else { return nil }

        let totalDays = max(
            (calendar.dateComponents([.day], from: periodStart, to: periodEnd).day ?? 0) + 1,
            1
        )
        let today = min(max(
            (calendar.dateComponents([.day], from: periodStart, to: referenceDay).day ?? 0) + 1,
            1
        ), totalDays)
        let tracked = (0 ... today).compactMap { day -> BalanceTrajectory.Point? in
            guard day > 0 else {
                return .init(day: 0, balance: metrics.available)
            }
            guard let endExclusive = calendar.date(
                byAdding: .day,
                value: day,
                to: periodStart
            ) else { return nil }
            let realized = realizedExpenses(
                before: endExclusive,
                periodStart: periodStart,
                budgetLines: budgetLines,
                transactions: transactions
            )
            return .init(day: day, balance: metrics.available - realized)
        }

        guard let current = tracked.last else { return nil }
        let remainingPlan = today < totalDays
            ? [current, .init(day: totalDays, balance: metrics.remaining)]
            : []
        return BalanceTrajectory(
            tracked: tracked,
            remainingPlan: remainingPlan,
            plannedBalance: plannedBalance,
            today: today,
            totalDays: totalDays
        )
    }
    // swiftlint:enable function_parameter_count

    private static func realizedExpenses(
        before endExclusive: Date,
        periodStart: Date,
        budgetLines: [BudgetLine],
        transactions: [Transaction]
    ) -> Decimal {
        let transactionsByLineId = Dictionary(
            grouping: transactions.filter {
                $0.isChecked
                    && $0.kind.isOutflow
                    && $0.transactionDate >= periodStart
                    && $0.transactionDate < endExclusive
            },
            by: { $0.budgetLineId ?? "" }
        )

        var total: Decimal = 0
        for line in budgetLines where line.kind.isOutflow && !(line.isRollover ?? false) {
            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0
            let wasChecked = line.checkedAt.map {
                $0 >= periodStart && $0 < endExclusive
            } ?? false
            total += wasChecked ? max(line.amount, consumed) : consumed
        }

        return total + (transactionsByLineId[""]?
            .reduce(Decimal.zero) { $0 + $1.amount } ?? 0)
    }
}
