import Foundation

extension BudgetFormulas {
    /// Sum amounts of transactions matching a kind predicate
    private static func consumed(_ txs: [Transaction], where matches: (TransactionKind) -> Bool) -> Decimal {
        txs.filter { matches($0.kind) }.reduce(.zero) { $0 + $1.amount }
    }

    /// Calculate all metrics at once using envelope logic
    /// Performance: O(n+m) with Dictionary-based indexing
    static func calculateAllMetrics(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = [],
        rollover: Decimal = 0
    ) -> Metrics {
        let txsByLineId = Dictionary(grouping: transactions, by: { $0.budgetLineId ?? "" })
        var totalIncome: Decimal = 0
        var totalExpenses: Decimal = 0
        var totalSavings: Decimal = 0

        for line in budgetLines {
            guard !(line.isRollover ?? false) else { continue }
            let lineTxs = txsByLineId[line.id] ?? []

            switch line.kind {
            case .income:
                totalIncome += max(line.amount, consumed(lineTxs) { $0 == .income })
            case .expense:
                totalExpenses += max(line.amount, consumed(lineTxs) { $0.isOutflow })
            case .saving:
                totalExpenses += max(line.amount, consumed(lineTxs) { $0.isOutflow })
                totalSavings += max(line.amount, consumed(lineTxs) { $0 == .saving })
            }
        }

        for tx in txsByLineId[""] ?? [] {
            if tx.kind == .income { totalIncome += tx.amount }
            if tx.kind.isOutflow { totalExpenses += tx.amount }
            if tx.kind == .saving { totalSavings += tx.amount }
        }

        let available = totalIncome + rollover
        let endingBalance = available - totalExpenses
        return Metrics(
            totalIncome: totalIncome, totalExpenses: totalExpenses, totalSavings: totalSavings,
            available: available, endingBalance: endingBalance, remaining: endingBalance,
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
