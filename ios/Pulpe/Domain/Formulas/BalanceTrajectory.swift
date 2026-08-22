import Foundation

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

        /// The user's usual drift, when the backend has closed months to read it from.
        var history: DriftHistory?

        /// Pay day: the date day 1 stands for. The chart prints it and the period's end
        /// under the plot, so the horizontal reads as time.
        var periodStart: Date?

        var periodEnd: Date? {
            periodStart.flatMap { Calendar.current.date(byAdding: .day, value: totalDays - 1, to: $0) }
        }

        /// Days the chart waits before letting the prior bend the line: earlier, no model
        /// beats noise, and a bend there would be noise dressed as insight.
        static let priorWarmupDays = 7

        /// Where the plan alone said the period would land. Equal to `plannedRemaining` by
        /// construction: day 0 has no transactions, so the same envelope arithmetic that
        /// yields the plan yields this. The chart's rule and the card's `Imprévus` reference
        /// are therefore one number, never two neighbouring calculations.
        var plannedBalance: Decimal { landing.first?.balance ?? 0 }

        /// Where it is now forecast to land: the hero's own figure, by the same argument
        /// applied to the last day, which holds every transaction the hero holds.
        var estimatedBalance: Decimal { landing.last?.balance ?? 0 }

        /// The gap the plot draws — and, by the two properties above, exactly the card's
        /// `Imprévus` metric. Neither can contradict the other.
        var drift: Decimal { estimatedBalance - plannedBalance }

        /// Where the period lands if it keeps leaving its plan at the pace seen so far:
        /// the estimate plus the drift per day lived, carried over the days left. The pace
        /// is shrunk toward a prior by how little of the month is known — one day of data
        /// weighs 1/(1+K), a full month nearly 1 — so an early outlier bends the line
        /// rather than throwing it. A held month, or the last day, lands on the estimate.
        ///
        /// Without `history` the prior is the plan itself (zero drift) and `priorDays` is K.
        /// With it, the prior is the user's usual drift rate applied to this month's planned
        /// outflows over the days left, K is `priorStrength`, and three guards hold it: the
        /// line stays flat before `priorWarmupDays`, the prior's pull never exceeds
        /// `driftMad`, and one or two closed months only count for `n/(n+2)` of it.
        ///
        /// The hero figure stays the estimate: this answers a different question ("and if
        /// you carry on?"), and a second figure is what the dashed stroke is for.
        func trendBalance(priorDays: Int) -> Decimal {
            let remaining = totalDays - today
            guard remaining > 0, today > 0 else { return estimatedBalance }
            guard let history else {
                guard drift != 0 else { return estimatedBalance }
                let pace = drift / Decimal(today)
                let weight = Decimal(today) / Decimal(today + max(priorDays, 0))
                return (estimatedBalance + pace * weight * Decimal(remaining)).rounded(2)
            }
            guard today >= Self.priorWarmupDays else { return estimatedBalance }
            let pace = drift / Decimal(today)
            let weight = Decimal(today) / Decimal(today + max(history.priorStrength, 0))
            let confidence = Decimal(history.closedMonths) / Decimal(history.closedMonths + 2)
            let rawPrior = confidence * history.usualOutflowDrift * plannedOutflows
                * Decimal(remaining) / Decimal(totalDays)
            let prior = min(max(rawPrior, -history.driftMad), history.driftMad)
            return (estimatedBalance + weight * pace * Decimal(remaining) + (1 - weight) * prior)
                .rounded(2)
        }
    }

    /// Replays the hero's own envelope arithmetic against the transactions each day knew
    /// about, so the line opens on the plan and arrives on the estimate.
    static func calculateBalanceTrajectory(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        budget: Budget,
        payDayOfMonth: Int?,
        history: DriftHistory? = nil,
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
            totalDays: totalDays,
            history: history,
            periodStart: periodStart
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
