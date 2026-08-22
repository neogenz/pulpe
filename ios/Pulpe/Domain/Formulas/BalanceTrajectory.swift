import Foundation

/// Port of shared/src/calculators/balance-trajectory.ts
extension BudgetFormulas {
    /// Where the period is forecast to land, read once per day elapsed. Day 0 knows nothing
    /// but the plan; today knows every transaction, so it is the estimate the hero prints.
    /// Between the two the line moves only when the month leaves its plan — pointing an
    /// operation confirms a forecast, it never changes one.
    struct BalanceTrajectory: Equatable, Sendable {
        struct Point: Identifiable, Equatable, Sendable {
            let day: Int
            let balance: Decimal

            var id: Int { day }
        }

        let landing: [Point]

        /// The day the forecast first left the plan it opened on. `nil` while the month is
        /// still landing exactly where it was planned to — a frequent, valid state, not an
        /// absence of measurement.
        let driftDate: Date?

        /// What the period planned to spend. The plot floors its vertical range on a
        /// fraction of this, so a month that barely moved is not blown up to fill the frame.
        let plannedOutflows: Decimal

        let today: Int
        let totalDays: Int

        /// Where the plan alone said the period would land. Equal to `plannedRemaining` by
        /// construction: day 0 has no transactions, so the same envelope arithmetic that
        /// yields the plan yields this. The chart's rule and the card's `vs prévu` reference
        /// are therefore one number, never two neighbouring calculations.
        var plannedBalance: Decimal { landing.first?.balance ?? 0 }

        /// Where it is now forecast to land: the hero's own figure, by the same argument
        /// applied to the last day, which holds every transaction the hero holds.
        var estimatedBalance: Decimal { landing.last?.balance ?? 0 }

        /// The gap the plot draws — and, by the two properties above, exactly the card's
        /// `vs prévu` metric. Neither can contradict the other.
        var drift: Decimal { estimatedBalance - plannedBalance }
    }

    /// Replays the hero's own envelope arithmetic against the transactions each day knew
    /// about, so the line opens on the plan and arrives on the estimate.
    static func calculateBalanceTrajectory(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
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
        let landing = landingSeries(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget.rollover.orZero,
            periodStart: periodStart,
            today: today
        )

        guard let opening = landing.first else { return nil }
        return BalanceTrajectory(
            landing: landing,
            // A reading at index `d` covers the days before it, so the one that first differs
            // was moved by activity on the day it opened — one back from its own index.
            driftDate: landing
                .first { $0.balance != opening.balance }
                .flatMap { calendar.date(byAdding: .day, value: $0.day - 1, to: periodStart) },
            plannedOutflows: budgetLines
                .filter { $0.kind.isOutflow && !($0.isRollover ?? false) }
                .reduce(Decimal.zero) { $0 + $1.amount },
            today: today,
            totalDays: totalDays
        )
    }
    /// One reading per day elapsed, each one asking the same question of a different amount
    /// of knowledge: given what is on file this morning, where does the period land?
    private static func landingSeries(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        rollover: Decimal,
        periodStart: Date,
        today: Int
    ) -> [BalanceTrajectory.Point] {
        let calendar = Calendar.current
        return (0 ... today).compactMap { day -> BalanceTrajectory.Point? in
            // The last reading is the hero's, so it takes the hero's inputs untouched: a
            // transaction dated outside the period still spends real money, and still has to
            // be counted when the line arrives on the figure printed above it.
            guard day < today else {
                return .init(day: day, balance: landingBalance(
                    budgetLines: budgetLines,
                    transactions: transactions,
                    rollover: rollover
                ))
            }
            guard let endExclusive = calendar.date(
                byAdding: .day,
                value: day,
                to: periodStart
            ) else { return nil }
            return .init(day: day, balance: landingBalance(
                budgetLines: budgetLines,
                transactions: transactions.filter {
                    $0.transactionDate >= periodStart && $0.transactionDate < endExclusive
                },
                rollover: rollover
            ))
        }
    }

    /// The same call the dashboard makes for its hero figure. Reusing it is the whole point:
    /// a private copy of the envelope rules here could drift from the number above the plot.
    /// It reads no `checkedAt`, which is why pointing an operation leaves the line flat.
    private static func landingBalance(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        rollover: Decimal
    ) -> Decimal {
        calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: rollover
        ).remaining
    }
}
