package app.pulpe.android.ui.screens.budgets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.BudgetRepository
import app.pulpe.android.domain.model.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import javax.inject.Inject

data class BudgetDetailsUiState(
    val budget: Budget? = null,
    val budgetLines: List<BudgetLine> = emptyList(),
    val transactions: List<Transaction> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val showAddTransactionSheet: Boolean = false
) {
    val metrics: BudgetFormulas.Metrics
        get() = BudgetFormulas.calculateAllMetrics(
            budgetLines = budgetLines,
            transactions = transactions,
            rollover = budget?.rolloverOrZero ?: BigDecimal.ZERO
        )

    val displayBudgetLines: List<BudgetLine>
        get() {
            val rollover = budget?.rollover ?: 0.0
            if (rollover == 0.0) return budgetLines

            val rolloverLine = BudgetLine.rolloverLine(
                amount = BigDecimal(rollover),
                budgetId = budget?.id ?: "",
                sourceBudgetId = budget?.previousBudgetId
            )
            return listOf(rolloverLine) + budgetLines
        }

    val recurringBudgetLines: List<BudgetLine>
        get() = displayBudgetLines
            .filter { it.recurrence == TransactionRecurrence.FIXED }
            .sortedByDescending { it.createdAt }

    val oneOffBudgetLines: List<BudgetLine>
        get() = displayBudgetLines
            .filter { it.recurrence == TransactionRecurrence.ONE_OFF && it.isRollover != true }
            .sortedByDescending { it.createdAt }

    fun getConsumption(line: BudgetLine): BudgetFormulas.Consumption {
        return BudgetFormulas.calculateConsumption(line, transactions)
    }
}

@HiltViewModel
class BudgetDetailsViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(BudgetDetailsUiState())
    val uiState: StateFlow<BudgetDetailsUiState> = _uiState.asStateFlow()

    fun loadBudget(budgetId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val result = budgetRepository.getBudgetDetails(budgetId)

            result.fold(
                onSuccess = { details ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            budget = details.budget,
                            budgetLines = details.budgetLines,
                            transactions = details.transactions.sortedByDescending { tx -> tx.transactionDate }
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Erreur lors du chargement"
                        )
                    }
                }
            )
        }
    }

    fun showAddTransaction() {
        _uiState.update { it.copy(showAddTransactionSheet = true) }
    }

    fun hideAddTransaction() {
        _uiState.update { it.copy(showAddTransactionSheet = false) }
    }
}
