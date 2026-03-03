import Foundation

extension BudgetFormulas {
    /// Calculate all metrics at once using envelope logic
    /// Performance: O(n+m) with Dictionary-based indexing
    static func calculateAllMetrics(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = [],
        rollover: Decimal = 0
    ) -> Metrics {
        let transactionsByLineId = Dictionary(
            grouping: transactions,
            by: { $0.budgetLineId ?? "" }
        )

        var totalIncome: Decimal = 0
        var totalExpenses: Decimal = 0
        var totalSavings: Decimal = 0

        for line in budgetLines {
            guard !(line.isRollover ?? false) else { continue }

            let consumed = transactionsByLineId[line.id]?
                .reduce(Decimal.zero) { $0 + $1.amount } ?? 0
            let effective = max(line.amount, consumed)

            switch line.kind {
            case .income:
                totalIncome += effective
            case .expense:
                totalExpenses += effective
            case .saving:
                totalSavings += effective
                totalExpenses += effective
            }
        }

        if let freeTransactions = transactionsByLineId[""] {
            for tx in freeTransactions {
                switch tx.kind {
                case .income:
                    totalIncome += tx.amount
                case .expense:
                    totalExpenses += tx.amount
                case .saving:
                    totalSavings += tx.amount
                    totalExpenses += tx.amount
                }
            }
        }

        let available = totalIncome + rollover
        let endingBalance = available - totalExpenses

        return Metrics(
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            totalSavings: totalSavings,
            available: available,
            endingBalance: endingBalance,
            remaining: endingBalance,
            rollover: rollover
        )
    }

    /// Calculate realized metrics
    static func calculateRealizedMetrics(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> RealizedMetrics {
        let realizedIncome = calculateRealizedIncome(budgetLines: budgetLines, transactions: transactions)
        let realizedExpenses = calculateRealizedExpenses(budgetLines: budgetLines, transactions: transactions)
        let realizedBalance = realizedIncome - realizedExpenses

        let checkedCount = budgetLines.filter { $0.isChecked }.count + transactions.filter { $0.isChecked }.count
        let totalCount = budgetLines.count + transactions.count

        let checkedSavingsAmount = budgetLines
            .filter { $0.isChecked && $0.kind == .saving }
            .reduce(Decimal.zero) { $0 + $1.amount }
            + transactions
            .filter { $0.isChecked && $0.kind == .saving }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return RealizedMetrics(
            realizedIncome: realizedIncome,
            realizedExpenses: realizedExpenses,
            realizedBalance: realizedBalance,
            checkedItemsCount: checkedCount,
            totalItemsCount: totalCount,
            checkedSavingsAmount: checkedSavingsAmount
        )
    }
}
