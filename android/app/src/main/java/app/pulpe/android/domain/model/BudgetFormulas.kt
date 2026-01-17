package app.pulpe.android.domain.model

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Budget calculation formulas - Single Source of Truth
 * Port of shared/src/calculators/budget-formulas.ts
 */
object BudgetFormulas {

    data class Metrics(
        val totalIncome: BigDecimal,
        val totalExpenses: BigDecimal,
        val totalSavings: BigDecimal,
        val available: BigDecimal,
        val endingBalance: BigDecimal,
        val remaining: BigDecimal,
        val rollover: BigDecimal
    ) {
        val usagePercentage: Double
            get() = if (available > BigDecimal.ZERO) {
                (totalExpenses.divide(available, 4, RoundingMode.HALF_UP) * BigDecimal(100)).toDouble()
            } else 0.0

        val isDeficit: Boolean
            get() = remaining < BigDecimal.ZERO
    }

    data class RealizedMetrics(
        val realizedIncome: BigDecimal,
        val realizedExpenses: BigDecimal,
        val realizedBalance: BigDecimal,
        val checkedItemsCount: Int,
        val totalItemsCount: Int
    ) {
        val completionPercentage: Double
            get() = if (totalItemsCount > 0) {
                checkedItemsCount.toDouble() / totalItemsCount * 100
            } else 0.0
    }

    data class Consumption(
        val allocated: BigDecimal,
        val available: BigDecimal,
        val percentage: Double
    ) {
        val isOverBudget: Boolean get() = percentage > 100
        val isNearLimit: Boolean get() = percentage in 80.0..100.0
    }

    data class TemplateTotals(
        val totalIncome: BigDecimal,
        val totalExpenses: BigDecimal,
        val balance: BigDecimal
    )

    fun calculateTotalIncome(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList()
    ): BigDecimal {
        val budgetIncome = budgetLines
            .filter { it.kind == TransactionKind.INCOME && it.isRollover != true }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amountDecimal }

        val transactionIncome = transactions
            .filter { it.kind == TransactionKind.INCOME }
            .fold(BigDecimal.ZERO) { acc, tx -> acc + tx.amountDecimal }

        return budgetIncome + transactionIncome
    }

    fun calculateTotalExpenses(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList()
    ): BigDecimal {
        val budgetExpenses = budgetLines
            .filter { it.kind.isOutflow && it.isRollover != true }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amountDecimal }

        val transactionExpenses = transactions
            .filter { it.kind.isOutflow }
            .fold(BigDecimal.ZERO) { acc, tx -> acc + tx.amountDecimal }

        return budgetExpenses + transactionExpenses
    }

    fun calculateTotalSavings(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList()
    ): BigDecimal {
        val budgetSavings = budgetLines
            .filter { it.kind == TransactionKind.SAVING && it.isRollover != true }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amountDecimal }

        val transactionSavings = transactions
            .filter { it.kind == TransactionKind.SAVING }
            .fold(BigDecimal.ZERO) { acc, tx -> acc + tx.amountDecimal }

        return budgetSavings + transactionSavings
    }

    fun calculateRealizedIncome(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList()
    ): BigDecimal {
        val checkedBudgetIncome = budgetLines
            .filter { it.isChecked && it.kind == TransactionKind.INCOME }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amountDecimal }

        val checkedTransactionIncome = transactions
            .filter { it.isChecked && it.kind == TransactionKind.INCOME }
            .fold(BigDecimal.ZERO) { acc, tx -> acc + tx.amountDecimal }

        return checkedBudgetIncome + checkedTransactionIncome
    }

    fun calculateRealizedExpenses(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList()
    ): BigDecimal {
        val checkedBudgetExpenses = budgetLines
            .filter { it.isChecked && it.kind.isOutflow }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amountDecimal }

        val checkedTransactionExpenses = transactions
            .filter { it.isChecked && it.kind.isOutflow }
            .fold(BigDecimal.ZERO) { acc, tx -> acc + tx.amountDecimal }

        return checkedBudgetExpenses + checkedTransactionExpenses
    }

    fun calculateAvailable(totalIncome: BigDecimal, rollover: BigDecimal): BigDecimal =
        totalIncome + rollover

    fun calculateEndingBalance(available: BigDecimal, totalExpenses: BigDecimal): BigDecimal =
        available - totalExpenses

    fun calculateAllMetrics(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList(),
        rollover: BigDecimal = BigDecimal.ZERO
    ): Metrics {
        val totalIncome = calculateTotalIncome(budgetLines, transactions)
        val totalExpenses = calculateTotalExpenses(budgetLines, transactions)
        val totalSavings = calculateTotalSavings(budgetLines, transactions)
        val available = calculateAvailable(totalIncome, rollover)
        val endingBalance = calculateEndingBalance(available, totalExpenses)

        return Metrics(
            totalIncome = totalIncome,
            totalExpenses = totalExpenses,
            totalSavings = totalSavings,
            available = available,
            endingBalance = endingBalance,
            remaining = endingBalance,
            rollover = rollover
        )
    }

    fun calculateRealizedMetrics(
        budgetLines: List<BudgetLine>,
        transactions: List<Transaction> = emptyList()
    ): RealizedMetrics {
        val realizedIncome = calculateRealizedIncome(budgetLines, transactions)
        val realizedExpenses = calculateRealizedExpenses(budgetLines, transactions)
        val realizedBalance = realizedIncome - realizedExpenses

        val checkedCount = budgetLines.count { it.isChecked } + transactions.count { it.isChecked }
        val totalCount = budgetLines.size + transactions.size

        return RealizedMetrics(
            realizedIncome = realizedIncome,
            realizedExpenses = realizedExpenses,
            realizedBalance = realizedBalance,
            checkedItemsCount = checkedCount,
            totalItemsCount = totalCount
        )
    }

    fun calculateConsumption(
        budgetLine: BudgetLine,
        transactions: List<Transaction>
    ): Consumption {
        val allocated = transactions
            .filter { it.budgetLineId == budgetLine.id }
            .fold(BigDecimal.ZERO) { acc, tx -> acc + tx.amountDecimal }

        val available = budgetLine.amountDecimal - allocated
        val percentage = if (budgetLine.amountDecimal > BigDecimal.ZERO) {
            (allocated.divide(budgetLine.amountDecimal, 4, RoundingMode.HALF_UP) * BigDecimal(100)).toDouble()
        } else 0.0

        return Consumption(
            allocated = allocated,
            available = available,
            percentage = percentage
        )
    }

    fun calculateTemplateTotals(lines: List<TemplateLine>): TemplateTotals {
        val income = lines
            .filter { it.kind == TransactionKind.INCOME }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amount.toBigDecimal() }

        val expenses = lines
            .filter { it.kind.isOutflow }
            .fold(BigDecimal.ZERO) { acc, line -> acc + line.amount.toBigDecimal() }

        return TemplateTotals(
            totalIncome = income,
            totalExpenses = expenses,
            balance = income - expenses
        )
    }
}
