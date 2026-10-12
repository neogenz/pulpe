import Foundation

/// The Monday-morning recap: what the week before recorded, and how the week starting
/// should go — room to spend, and the forecasts usually pointed during it. Computed on
/// device because amounts only decrypt here (split-key encryption, docs/ENCRYPTION.md):
/// neither a server push nor a remote model could build it without the client key.
///
/// Notification content, not a business formula: every amount derives from the mirrored
/// `BudgetFormulas`, and no web screen shows these figures, so nothing here can diverge
/// from a TypeScript twin (see formula-mirrors-ts-swift.md).
struct WeeklyRecap: Equatable, Sendable {
    /// Movements dated in the 7 days before the recap.
    let movementCount: Int
    /// Room to spend this week: "Disponible à dépenser" split per day left in the period
    /// (the home's `dailyBudget` split), times this week's days in it. Zero once nothing is
    /// left; `nil` when the recap falls past pay-day, in a period not loaded yet.
    let weekAllowance: Decimal?
    /// Average free spending per week over the 4 weeks before the recap. `nil` until
    /// those weeks hold history (a new user's empty weeks are not a habit) or when nothing
    /// was spent outside the forecasts.
    let usualWeekSpending: Decimal?
    /// Unchecked monthly forecasts the user usually points during this week, per the
    /// `checkingDays` habits, earliest first.
    let expectedLineNames: [String]

    static func make(
        on fireDate: Date,
        transactions: [Transaction],
        current: BudgetDetails,
        payDayOfMonth: Int?,
        calendar: Calendar = .current
    ) -> WeeklyRecap {
        let weekStart = calendar.startOfDay(for: fireDate)
        let daysBefore = { (count: Int) in calendar.date(byAdding: .day, value: -count, to: weekStart) ?? weekStart }

        let movementCount = transactions.filter { (daysBefore(7)..<weekStart).contains($0.transactionDate) }.count

        let usualWeekSpending: Decimal? = {
            guard transactions.contains(where: { $0.transactionDate < daysBefore(21) }) else { return nil }
            let lastFourWeeks = daysBefore(28)..<weekStart
            let spent = transactions
                .filter { $0.kind == .expense && $0.isFree && lastFourWeeks.contains($0.transactionDate) }
                .reduce(Decimal.zero) { $0 + $1.amount }
            return spent > 0 ? spent / 4 : nil
        }()

        let budget = current.budget
        let period = BudgetPeriodCalculator.periodDates(
            month: budget.month, year: budget.year, payDayOfMonth: payDayOfMonth
        )
        let periodStart = calendar.startOfDay(for: period.startDate)
        let periodEnd = calendar.startOfDay(for: period.endDate)
        guard (periodStart...periodEnd).contains(weekStart) else {
            return WeeklyRecap(
                movementCount: movementCount,
                weekAllowance: nil,
                usualWeekSpending: usualWeekSpending,
                expectedLineNames: []
            )
        }

        let daysLeft = (calendar.dateComponents([.day], from: weekStart, to: periodEnd).day ?? 0) + 1
        let remaining = BudgetFormulas.calculateAllMetrics(
            budgetLines: current.budgetLines,
            transactions: current.transactions,
            rollover: budget.rollover.orZero
        ).remaining
        let weekAllowance = remaining > 0 ? remaining / Decimal(daysLeft) * Decimal(min(7, daysLeft)) : 0

        // `checkingDays` holds 1-based period days, so the week is expressed in them too.
        let firstPeriodDay = (calendar.dateComponents([.day], from: periodStart, to: weekStart).day ?? 0) + 1
        let thisWeek = firstPeriodDay..<(firstPeriodDay + 7)
        let checkingDays = current.checkingDays ?? [:]
        let expectedLineNames = current.budgetLines
            .filter { line in
                guard let day = checkingDays[line.id] else { return false }
                return thisWeek.contains(day) && !line.isChecked && !(line.isRollover ?? false)
            }
            .sorted { (checkingDays[$0.id] ?? 0) < (checkingDays[$1.id] ?? 0) }
            .map(\.name)

        return WeeklyRecap(
            movementCount: movementCount,
            weekAllowance: weekAllowance,
            usualWeekSpending: usualWeekSpending,
            expectedLineNames: expectedLineNames
        )
    }
}
