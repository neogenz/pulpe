import Foundation

/// « Le calcul » in words: the formula of the disponible, line by line, and the sentence that
/// explains its gap to the plan. Pure presentation: every figure is a `calculateAllMetrics`
/// output on a slice of the month, so the lines add up to `metrics.remaining` by construction.
enum CalculationPresentation {
    struct Row: Equatable {
        let title: String
        var caption: String?
        /// The line's contribution to the disponible: positive in, negative out.
        let amount: Decimal
    }

    /// Revenus (one line per income prévision), the report, the prévisions of spending, what no
    /// prévision covers, the planned savings. Each envelope counts « le plus haut entre prévu
    /// et dépensé », exactly as the month's metrics do.
    static func rows(
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        rollover: Decimal,
        previousMonth: Int
    ) -> [Row] {
        let lines = budgetLines.filter { !($0.isRollover ?? false) }
        let allocated = transactions.filter { $0.budgetLineId != nil }
        let free = BudgetFormulas.calculateAllMetrics(
            budgetLines: [], transactions: transactions.filter { $0.budgetLineId == nil }
        )
        func metrics(_ kind: TransactionKind) -> BudgetFormulas.Metrics {
            BudgetFormulas.calculateAllMetrics(budgetLines: lines.filter { $0.kind == kind }, transactions: allocated)
        }

        var rows = lines.filter { $0.kind == .income }.map { line in
            Row(
                title: line.name,
                amount: BudgetFormulas.calculateAllMetrics(budgetLines: [line], transactions: allocated).totalIncome
            )
        }
        if free.totalIncome != 0 {
            rows.append(Row(
                title: PendingWording.unplanned,
                caption: AppLocale.string("Revenus sans prévision"),
                amount: free.totalIncome
            ))
        }
        if rollover != 0 {
            rows.append(Row(title: ReportWording.reportTitle(of: previousMonth), amount: rollover))
        }
        rows.append(Row(
            title: AppLocale.string("Dépenses prévues"),
            caption: AppLocale.string("Le plus haut entre prévu et dépensé"),
            amount: -metrics(.expense).totalExpenses
        ))
        if free.totalExpenses != 0 {
            rows.append(Row(
                title: PendingWording.unplanned,
                caption: AppLocale.string("Sans prévision"),
                amount: -free.totalExpenses
            ))
        }
        rows.append(Row(title: AppLocale.string("Épargne prévue"), amount: -metrics(.saving).totalSavings))
        return rows
    }

    /// What moved the month off its plan, named: the prévisions past their plan with how far,
    /// then the movements no prévision covers. `nil` when there is nothing to name.
    static func gapCauses(
        overruns: [(name: String, overrun: Decimal)],
        unplannedOutflows: [Transaction],
        currency: SupportedCurrency
    ) -> String? {
        let parts = overruns.map { "\($0.name) +\($0.overrun.asAmount(for: currency))" }
            + unplannedOutflows
            .sorted { $0.amount > $1.amount }
            .map { "\($0.name) \($0.amount.asAmount(for: currency))" }
        return parts.isEmpty ? nil : listed(parts) + "."
    }

    /// "a", "a et b", "a, b et c", then "a, b et 3 autres".
    static func listed(_ parts: [String]) -> String {
        switch parts.count {
        case 0: ""
        case 1: parts[0]
        case 2: AppLocale.string("\(parts[0]) et \(parts[1])")
        case 3: AppLocale.string("\(parts[0]), \(parts[1]) et \(parts[2])")
        default: AppLocale.string("\(parts[0]), \(parts[1]) et \(parts.count - 2) autres")
        }
    }
}
