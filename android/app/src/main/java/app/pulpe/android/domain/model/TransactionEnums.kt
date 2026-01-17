package app.pulpe.android.domain.model

import androidx.compose.ui.graphics.Color
import app.pulpe.android.ui.theme.FinancialExpense
import app.pulpe.android.ui.theme.FinancialIncome
import app.pulpe.android.ui.theme.FinancialSavings
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Type of financial flow
 */
@Serializable
enum class TransactionKind {
    @SerialName("income")
    INCOME,
    @SerialName("expense")
    EXPENSE,
    @SerialName("saving")
    SAVING;

    val label: String
        get() = when (this) {
            INCOME -> "Revenu"
            EXPENSE -> "Dépense"
            SAVING -> "Épargne"
        }

    val icon: String
        get() = when (this) {
            INCOME -> "arrow_downward"
            EXPENSE -> "arrow_upward"
            SAVING -> "savings"
        }

    val color: Color
        get() = when (this) {
            INCOME -> FinancialIncome
            EXPENSE -> FinancialExpense
            SAVING -> FinancialSavings
        }

    val isOutflow: Boolean
        get() = this == EXPENSE || this == SAVING
}

/**
 * Recurrence type for budget lines
 */
@Serializable
enum class TransactionRecurrence {
    @SerialName("fixed")
    FIXED,
    @SerialName("one_off")
    ONE_OFF;

    val label: String
        get() = when (this) {
            FIXED -> "Récurrent"
            ONE_OFF -> "Prévu"
        }

    val longLabel: String
        get() = when (this) {
            FIXED -> "Tous les mois"
            ONE_OFF -> "Une seule fois"
        }

    val icon: String
        get() = when (this) {
            FIXED -> "repeat"
            ONE_OFF -> "looks_one"
        }
}
