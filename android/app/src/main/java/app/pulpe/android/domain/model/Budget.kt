package app.pulpe.android.domain.model

import kotlinx.serialization.Serializable
import java.math.BigDecimal
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Monthly budget instance created from a template
 */
@Serializable
data class Budget(
    val id: String,
    val month: Int,
    val year: Int,
    val description: String,
    val userId: String? = null,
    val templateId: String,
    val endingBalance: Double? = null,
    val rollover: Double? = null,
    val remaining: Double? = null,
    val previousBudgetId: String? = null,
    val createdAt: String,
    val updatedAt: String
) {
    val monthYear: String
        get() {
            val yearMonth = YearMonth.of(year, month)
            val formatter = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.FRENCH)
            return yearMonth.format(formatter).replaceFirstChar { it.uppercase() }
        }

    val shortMonthYear: String
        get() {
            val yearMonth = YearMonth.of(year, month)
            val formatter = DateTimeFormatter.ofPattern("MMM yyyy", Locale.FRENCH)
            return yearMonth.format(formatter).replaceFirstChar { it.uppercase() }
        }

    val isCurrentMonth: Boolean
        get() {
            val now = YearMonth.now()
            return month == now.monthValue && year == now.year
        }

    val rolloverOrZero: BigDecimal
        get() = rollover?.toBigDecimal() ?: BigDecimal.ZERO
}

/**
 * Budget creation DTO
 */
@Serializable
data class BudgetCreate(
    val month: Int,
    val year: Int,
    val description: String = "",
    val templateId: String
)

/**
 * Budget update DTO
 */
@Serializable
data class BudgetUpdate(
    val description: String? = null,
    val month: Int? = null,
    val year: Int? = null
)

/**
 * Budget details with transactions and lines
 */
@Serializable
data class BudgetDetails(
    val budget: Budget,
    val transactions: List<Transaction>,
    val budgetLines: List<BudgetLine>
)

/**
 * Budget with full details for export
 */
@Serializable
data class BudgetWithDetails(
    val id: String,
    val month: Int,
    val year: Int,
    val description: String,
    val templateId: String,
    val endingBalance: Double? = null,
    val rollover: Double,
    val remaining: Double,
    val previousBudgetId: String? = null,
    val transactions: List<Transaction>,
    val budgetLines: List<BudgetLine>,
    val createdAt: String,
    val updatedAt: String
)
