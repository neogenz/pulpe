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
    /// The part of `expenses` set aside as savings (« Épargne versée »).
    let savings: Decimal
    /// What the closed month itself inherited from the one before it.
    let previousRollover: Decimal
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

    /// The outflows that were spent, savings set apart: « Dépenses » in the Bilan.
    var spending: Decimal { expenses - savings }

    /// Half a franc either way, inclusive — the webapp's `monthRecapOutcome`, spelled out
    /// rather than left to a rounding mode the two platforms break ties on differently.
    var outcome: Outcome {
        let margin = Decimal(string: "0.5") ?? 0
        if endingBalance >= margin { return .saved }
        if endingBalance <= -margin { return .overspent }
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
            savings: closed.totalSavings ?? 0,
            previousRollover: closed.rollover ?? 0,
            endingBalance: income - expenses,
            carriedOver: metrics.rollover,
            startingAvailable: metrics.available
        )
    }
}

/// « Ce qui a compté »: at most three facts read from the closed month's own details: its
/// savings, the prévisions that ran past their plan, and what was pointed. Pure, so the
/// wording and the thresholds are pinned by tests.
enum MonthRecapFindings {
    struct Finding: Equatable {
        let title: String
        let subtitle: String
        /// An overrun total, shown in the ocre. `nil` for a fact with no figure.
        var overrun: Decimal?
    }

    static func make(
        lines: [BudgetLine],
        transactions: [Transaction],
        month: Int,
        currency: SupportedCurrency
    ) -> [Finding] {
        let lines = lines.filter { !($0.isRollover ?? false) }
        var findings: [Finding] = []

        let savings = lines.filter { $0.kind == .saving }
        if !savings.isEmpty {
            let missing = savings.filter { line in
                !line.isChecked
                    && BudgetFormulas.calculateConsumption(for: line, transactions: transactions).available > 0
            }
            findings.append(missing.isEmpty
                ? Finding(
                    title: AppLocale.string("Épargne versée en entier"),
                    subtitle: savings
                        .map { "\($0.name) \($0.amount.asAmount(for: currency))" }
                        .joined(separator: " · ")
                )
                : Finding(
                    title: AppLocale.string("Épargne versée en partie"),
                    subtitle: AppLocale.string("Pas versé : \(CalculationPresentation.listed(missing.map(\.name)))")
                ))
        }

        let overruns = lines.filter { $0.kind == .expense }.compactMap { line -> (String, Decimal)? in
            let available = BudgetFormulas.calculateConsumption(for: line, transactions: transactions).available
            return available < 0 ? (line.name, -available) : nil
        }
        .sorted { $0.1 > $1.1 }
        if !overruns.isEmpty {
            findings.append(Finding(
                title: AppLocale.string("\(overruns.count) prévisions dépassées"),
                subtitle: CalculationPresentation.listed(overruns.map(\.0)),
                overrun: overruns.reduce(.zero) { $0 + $1.1 }
            ))
        }

        let monthName = Formatters.monthNameInText(for: month)
        let pointed = transactions.count(where: \.isChecked)
        let waiting = transactions.count { !$0.isChecked } + lines.count { !$0.isChecked }
        if waiting == 0, pointed > 0 {
            findings.append(Finding(
                title: AppLocale.string("Tout est pointé"),
                subtitle: AppLocale.string("\(pointed) mouvements pointés en \(monthName)")
            ))
        } else if waiting > 0 {
            findings.append(Finding(
                title: AppLocale.string("\(waiting) encore à pointer"),
                subtitle: pointed == 0
                    ? AppLocale.string("Rien de pointé en \(monthName)")
                    : AppLocale.string("\(pointed) mouvements pointés en \(monthName)")
            ))
        }
        return findings
    }
}
