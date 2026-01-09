import Foundation

/// Budget calculation formulas - Single Source of Truth
/// Port of shared/src/calculators/budget-formulas.ts
enum BudgetFormulas {

    // MARK: - Metrics Result

    struct Metrics: Equatable, Sendable {
        let totalIncome: Decimal
        let totalExpenses: Decimal
        let totalSavings: Decimal
        let available: Decimal
        let endingBalance: Decimal
        let remaining: Decimal
        let rollover: Decimal

        /// Percentage of budget used (0-100+)
        var usagePercentage: Double {
            guard available > 0 else { return 0 }
            let used = totalExpenses
            return Double(truncating: (used / available * 100) as NSDecimalNumber)
        }

        /// Whether the budget is in deficit
        var isDeficit: Bool {
            remaining < 0
        }
    }

    // MARK: - Realized Metrics

    struct RealizedMetrics: Equatable, Sendable {
        let realizedIncome: Decimal
        let realizedExpenses: Decimal
        let realizedBalance: Decimal
        let checkedItemsCount: Int
        let totalItemsCount: Int

        var completionPercentage: Double {
            guard totalItemsCount > 0 else { return 0 }
            return Double(checkedItemsCount) / Double(totalItemsCount) * 100
        }
    }

    // MARK: - Income Calculations

    /// Calculate total income from budget lines and transactions
    /// Formula: Σ(items WHERE kind = 'income')
    static func calculateTotalIncome(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let budgetIncome = budgetLines
            .filter { $0.kind == .income && !($0.isRollover ?? false) }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let transactionIncome = transactions
            .filter { $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return budgetIncome + transactionIncome
    }

    // MARK: - Expense Calculations

    /// Calculate total expenses (expenses + savings) from budget lines and transactions
    /// Formula: Σ(items WHERE kind IN ('expense', 'saving'))
    /// Note: Savings are treated as expenses per SPECS
    static func calculateTotalExpenses(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let budgetExpenses = budgetLines
            .filter { $0.kind.isOutflow && !($0.isRollover ?? false) }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let transactionExpenses = transactions
            .filter { $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return budgetExpenses + transactionExpenses
    }

    // MARK: - Savings Calculations

    /// Calculate total savings from budget lines and transactions
    /// Formula: Σ(items WHERE kind = 'saving')
    static func calculateTotalSavings(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let budgetSavings = budgetLines
            .filter { $0.kind == .saving && !($0.isRollover ?? false) }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let transactionSavings = transactions
            .filter { $0.kind == .saving }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return budgetSavings + transactionSavings
    }

    // MARK: - Realized Calculations (checked items only)

    /// Calculate realized income (only checked items)
    static func calculateRealizedIncome(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let checkedBudgetIncome = budgetLines
            .filter { $0.isChecked && $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let checkedTransactionIncome = transactions
            .filter { $0.isChecked && $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return checkedBudgetIncome + checkedTransactionIncome
    }

    /// Calculate realized expenses (only checked items)
    static func calculateRealizedExpenses(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let checkedBudgetExpenses = budgetLines
            .filter { $0.isChecked && $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let checkedTransactionExpenses = transactions
            .filter { $0.isChecked && $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return checkedBudgetExpenses + checkedTransactionExpenses
    }

    /// Calculate realized balance (checked income - checked expenses)
    static func calculateRealizedBalance(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = []
    ) -> Decimal {
        let realizedIncome = calculateRealizedIncome(budgetLines: budgetLines, transactions: transactions)
        let realizedExpenses = calculateRealizedExpenses(budgetLines: budgetLines, transactions: transactions)
        return realizedIncome - realizedExpenses
    }

    // MARK: - Core Formulas

    /// Calculate available amount
    /// Formula: available = totalIncome + rollover
    static func calculateAvailable(totalIncome: Decimal, rollover: Decimal) -> Decimal {
        totalIncome + rollover
    }

    /// Calculate ending balance
    /// Formula: endingBalance = available - totalExpenses
    static func calculateEndingBalance(available: Decimal, totalExpenses: Decimal) -> Decimal {
        available - totalExpenses
    }

    /// Calculate remaining (same as ending balance per SPECS)
    /// Formula: remaining = available - totalExpenses
    static func calculateRemaining(available: Decimal, totalExpenses: Decimal) -> Decimal {
        calculateEndingBalance(available: available, totalExpenses: totalExpenses)
    }

    // MARK: - All Metrics

    /// Calculate all metrics at once (optimized)
    static func calculateAllMetrics(
        budgetLines: [BudgetLine],
        transactions: [Transaction] = [],
        rollover: Decimal = 0
    ) -> Metrics {
        let totalIncome = calculateTotalIncome(budgetLines: budgetLines, transactions: transactions)
        let totalExpenses = calculateTotalExpenses(budgetLines: budgetLines, transactions: transactions)
        let totalSavings = calculateTotalSavings(budgetLines: budgetLines, transactions: transactions)
        let available = calculateAvailable(totalIncome: totalIncome, rollover: rollover)
        let endingBalance = calculateEndingBalance(available: available, totalExpenses: totalExpenses)

        return Metrics(
            totalIncome: totalIncome,
            totalExpenses: totalExpenses,
            totalSavings: totalSavings,
            available: available,
            endingBalance: endingBalance,
            remaining: endingBalance, // Same as ending balance per SPECS
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

        return RealizedMetrics(
            realizedIncome: realizedIncome,
            realizedExpenses: realizedExpenses,
            realizedBalance: realizedBalance,
            checkedItemsCount: checkedCount,
            totalItemsCount: totalCount
        )
    }

    // MARK: - Consumption Tracking

    struct Consumption: Equatable, Sendable {
        let allocated: Decimal
        let available: Decimal
        let percentage: Double

        var isOverBudget: Bool { percentage > 100 }
        var isNearLimit: Bool { percentage >= 80 && percentage <= 100 }
    }

    /// Calculate consumption for a budget line based on allocated transactions
    static func calculateConsumption(
        for budgetLine: BudgetLine,
        transactions: [Transaction]
    ) -> Consumption {
        let allocated = transactions
            .filter { $0.budgetLineId == budgetLine.id }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let available = budgetLine.amount - allocated
        let percentage = budgetLine.amount > 0
            ? Double(truncating: (allocated / budgetLine.amount * 100) as NSDecimalNumber)
            : 0

        return Consumption(
            allocated: allocated,
            available: available,
            percentage: percentage
        )
    }

    // MARK: - Template Totals

    struct TemplateTotals: Equatable, Sendable {
        let totalIncome: Decimal
        let totalExpenses: Decimal
        let balance: Decimal
    }

    /// Calculate totals for a template
    static func calculateTemplateTotals(lines: [TemplateLine]) -> TemplateTotals {
        let income = lines
            .filter { $0.kind == .income }
            .reduce(Decimal.zero) { $0 + $1.amount }

        let expenses = lines
            .filter { $0.kind.isOutflow }
            .reduce(Decimal.zero) { $0 + $1.amount }

        return TemplateTotals(
            totalIncome: income,
            totalExpenses: expenses,
            balance: income - expenses
        )
    }
}
