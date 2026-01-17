package app.pulpe.android.domain.model

import kotlinx.serialization.Serializable
import java.math.BigDecimal

/**
 * Transaction representing an actual financial operation
 */
@Serializable
data class Transaction(
    val id: String,
    val budgetId: String,
    val budgetLineId: String? = null,
    val name: String,
    val amount: Double,
    val kind: TransactionKind,
    val transactionDate: String,
    val category: String? = null,
    val checkedAt: String? = null,
    val createdAt: String,
    val updatedAt: String
) {
    val isChecked: Boolean
        get() = checkedAt != null

    val isAllocated: Boolean
        get() = budgetLineId != null

    val isFree: Boolean
        get() = budgetLineId == null

    val amountDecimal: BigDecimal
        get() = amount.toBigDecimal()

    fun toggled(): Transaction = copy(
        checkedAt = if (isChecked) null else java.time.Instant.now().toString(),
        updatedAt = java.time.Instant.now().toString()
    )
}

/**
 * Transaction creation DTO
 */
@Serializable
data class TransactionCreate(
    val budgetId: String,
    val budgetLineId: String? = null,
    val name: String,
    val amount: Double,
    val kind: TransactionKind,
    val transactionDate: String? = null,
    val category: String? = null,
    val checkedAt: String? = null
)

/**
 * Transaction update DTO
 */
@Serializable
data class TransactionUpdate(
    val name: String? = null,
    val amount: Double? = null,
    val kind: TransactionKind? = null,
    val transactionDate: String? = null,
    val category: String? = null
)
