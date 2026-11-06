import Foundation

/// What a goal's « Historique » tells, resolved once from the server progression and the
/// realised withdrawals: the account at the top, then one group per month that moved,
/// newest first. A month where nothing was pointed and nothing left has no group: the
/// history only tells what happened, and the gap reads in a balance that stays put.
struct GoalHistoryPresentation: Equatable {
    struct Month: Identifiable, Equatable {
        let period: BudgetPeriod
        /// The pot at the end of the month; `nil` for a month outside the plan window.
        let endBalance: Decimal?
        /// Only on the oldest month: the money already put aside when the goal was created.
        let initialAmount: Decimal?
        let contribution: Contribution?
        let withdrawals: [SavingsGoalWithdrawal]

        var id: String { "\(period.year)-\(period.month)" }
    }

    /// What was pointed in a month against what the plan asked of it.
    struct Contribution: Equatable {
        let amount: Decimal
        /// 0…1, full when the month met its plan or had no plan to meet.
        let fraction: Double

        var percent: String { Decimal(Int((fraction * 100).rounded())).asPercentage() }
    }

    let initialAmount: Decimal
    /// Derived so the account always adds up to the hero figure: départ + versé − retiré.
    let contributed: Decimal
    let withdrawn: Decimal
    let saved: Decimal
    let pointedMonthCount: Int
    let withdrawalCount: Int
    let months: [Month]

    init(progress: SavingsGoalProgress, withdrawals: [SavingsGoalWithdrawal], payDayOfMonth: Int?) {
        let timeline = progress.months.filter { $0.state == .past || $0.state == .current }
        initialAmount = progress.initialAmount
        saved = progress.confirmed
        withdrawn = timeline.reduce(Decimal.zero) { $0 + $1.withdrawnAmount }
        contributed = progress.confirmed - progress.initialAmount + withdrawn
        pointedMonthCount = timeline.count { $0.confirmedAmount > 0 }
        withdrawalCount = withdrawals.count

        var byPeriod: [BudgetPeriod: [SavingsGoalWithdrawal]] = [:]
        for withdrawal in withdrawals {
            let period = BudgetPeriodCalculator.periodForDate(withdrawal.transactionDate, payDayOfMonth: payDayOfMonth)
            byPeriod[period, default: []].append(withdrawal)
        }

        var months: [Month] = []
        for (index, month) in timeline.enumerated() {
            let period = BudgetPeriod(month: month.month, year: month.year)
            let initial = index == 0 && progress.initialAmount > 0 ? progress.initialAmount : nil
            let contribution = month.confirmedAmount > 0
                ? Contribution(amount: month.confirmedAmount, fraction: Self.fraction(month))
                : nil
            let drawn = byPeriod.removeValue(forKey: period) ?? []
            guard initial != nil || contribution != nil || !drawn.isEmpty else { continue }
            months.append(Month(
                period: period,
                endBalance: month.confirmedCumulative,
                initialAmount: initial,
                contribution: contribution,
                withdrawals: drawn
            ))
        }
        // A withdrawal the plan window does not reach still belongs in the story.
        months += byPeriod.map { period, drawn in
            Month(period: period, endBalance: nil, initialAmount: nil, contribution: nil, withdrawals: drawn)
        }
        self.months = months.sorted { ($0.period.year, $0.period.month) > ($1.period.year, $1.period.month) }
    }

    /// Whether the detail offers the « Historique » row at all.
    var hasContent: Bool { !months.isEmpty }

    /// « 300.00 de départ, 2 mois pointés, 1 retrait ».
    func summary(currency: SupportedCurrency) -> String {
        var parts: [String] = []
        if initialAmount > 0 {
            parts.append(AppLocale.string("\(initialAmount.asAmount(for: currency)) de départ"))
        }
        if pointedMonthCount > 0 {
            parts.append(pointedMonthCount == 1
                ? AppLocale.string("1 mois pointé")
                : AppLocale.string("\(pointedMonthCount) mois pointés"))
        }
        if withdrawalCount > 0 {
            parts.append(withdrawalCount == 1
                ? AppLocale.string("1 retrait")
                : AppLocale.string("\(withdrawalCount) retraits"))
        }
        return parts.joined(separator: ", ")
    }

    private static func fraction(_ month: SavingsGoalPlanMonth) -> Double {
        guard month.plannedAmount > 0 else { return 1 }
        let ratio = ((month.confirmedAmount / month.plannedAmount) as NSDecimalNumber).doubleValue
        return min(max(ratio, 0), 1)
    }
}
