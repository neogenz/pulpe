package app.pulpe.android.domain.model

import kotlinx.serialization.Serializable
import java.math.BigDecimal

/**
 * Budget line representing a planned financial item (income, expense, or saving)
 */
@Serializable
data class BudgetLine(
    val id: String,
    val budgetId: String,
    val templateLineId: String? = null,
    val savingsGoalId: String? = null,
    val name: String,
    val amount: Double,
    val kind: TransactionKind,
    val recurrence: TransactionRecurrence,
    val isManuallyAdjusted: Boolean,
    val checkedAt: String? = null,
    val createdAt: String,
    val updatedAt: String,
    val isRollover: Boolean? = null,
    val rolloverSourceBudgetId: String? = null
) {
    val isChecked: Boolean
        get() = checkedAt != null

    val isFromTemplate: Boolean
        get() = templateLineId != null

    val isVirtualRollover: Boolean
        get() = isRollover == true

    val amountDecimal: BigDecimal
        get() = amount.toBigDecimal()

    fun toggled(): BudgetLine = copy(
        checkedAt = if (isChecked) null else java.time.Instant.now().toString(),
        updatedAt = java.time.Instant.now().toString()
    )

    companion object {
        fun rolloverLine(amount: BigDecimal, budgetId: String, sourceBudgetId: String?): BudgetLine {
            val now = java.time.Instant.now().toString()
            return BudgetLine(
                id = "rollover-$budgetId",
                budgetId = budgetId,
                templateLineId = null,
                savingsGoalId = null,
                name = "Report du mois précédent",
                amount = amount.toDouble(),
                kind = if (amount >= BigDecimal.ZERO) TransactionKind.INCOME else TransactionKind.EXPENSE,
                recurrence = TransactionRecurrence.ONE_OFF,
                isManuallyAdjusted = false,
                checkedAt = now,
                createdAt = now,
                updatedAt = now,
                isRollover = true,
                rolloverSourceBudgetId = sourceBudgetId
            )
        }
    }
}

/**
 * Budget line creation DTO
 */
@Serializable
data class BudgetLineCreate(
    val budgetId: String,
    val templateLineId: String? = null,
    val savingsGoalId: String? = null,
    val name: String,
    val amount: Double,
    val kind: TransactionKind,
    val recurrence: TransactionRecurrence,
    val isManuallyAdjusted: Boolean = false,
    val checkedAt: String? = null
)

/**
 * Budget line update DTO
 */
@Serializable
data class BudgetLineUpdate(
    val id: String,
    val name: String? = null,
    val amount: Double? = null,
    val kind: TransactionKind? = null,
    val isManuallyAdjusted: Boolean? = null,
    val checkedAt: String? = null
)
