package app.pulpe.android.ui.screens.currentmonth

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
import java.time.LocalDate
import java.time.YearMonth
import javax.inject.Inject

data class CurrentMonthUiState(
    val budget: Budget? = null,
    val budgetLines: List<BudgetLine> = emptyList(),
    val transactions: List<Transaction> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val showAddTransactionSheet: Boolean = false,
    val showRealizedBalanceSheet: Boolean = false
) {
    val metrics: BudgetFormulas.Metrics
        get() = BudgetFormulas.calculateAllMetrics(
            budgetLines = budgetLines,
            transactions = transactions,
            rollover = budget?.rolloverOrZero ?: BigDecimal.ZERO
        )

    val realizedMetrics: BudgetFormulas.RealizedMetrics
        get() = BudgetFormulas.calculateRealizedMetrics(
            budgetLines = budgetLines,
            transactions = transactions
        )

    val daysRemaining: Int
        get() {
            val today = LocalDate.now()
            val endOfMonth = YearMonth.now().atEndOfMonth()
            return (endOfMonth.dayOfMonth - today.dayOfMonth + 1).coerceAtLeast(1)
        }

    val dailyBudget: BigDecimal
        get() {
            if (daysRemaining <= 0 || metrics.remaining <= BigDecimal.ZERO) {
                return BigDecimal.ZERO
            }
            return metrics.remaining.divide(BigDecimal(daysRemaining), 2, java.math.RoundingMode.HALF_UP)
        }

    val alertBudgetLines: List<Pair<BudgetLine, BudgetFormulas.Consumption>>
        get() = budgetLines
            .filter { it.kind.isOutflow && it.isRollover != true }
            .mapNotNull { line ->
                val consumption = BudgetFormulas.calculateConsumption(line, transactions)
                if (consumption.percentage >= 80) {
                    line to consumption
                } else null
            }
            .sortedByDescending { it.second.percentage }

    val recentTransactions: List<Transaction>
        get() = transactions
            .sortedByDescending { it.transactionDate }
            .take(5)

    val uncheckedTransactions: List<Transaction>
        get() = transactions
            .filter { !it.isChecked }
            .sortedByDescending { it.transactionDate }
            .take(5)
}

@HiltViewModel
class CurrentMonthViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CurrentMonthUiState())
    val uiState: StateFlow<CurrentMonthUiState> = _uiState.asStateFlow()

    fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val budgetResult = budgetRepository.getCurrentMonthBudget()
            budgetResult.fold(
                onSuccess = { budget ->
                    if (budget == null) {
                        _uiState.update {
                            it.copy(
                                isLoading = false,
                                budget = null,
                                budgetLines = emptyList(),
                                transactions = emptyList()
                            )
                        }
                    } else {
                        loadBudgetDetails(budget.id)
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

    private suspend fun loadBudgetDetails(budgetId: String) {
        val detailsResult = budgetRepository.getBudgetDetails(budgetId)
        detailsResult.fold(
            onSuccess = { details ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        budget = details.budget,
                        budgetLines = details.budgetLines,
                        transactions = details.transactions
                    )
                }
            },
            onFailure = { error ->
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = error.message ?: "Erreur lors du chargement des détails"
                    )
                }
            }
        )
    }

    fun showAddTransaction() {
        _uiState.update { it.copy(showAddTransactionSheet = true) }
    }

    fun hideAddTransaction() {
        _uiState.update { it.copy(showAddTransactionSheet = false) }
    }

    fun showRealizedBalance() {
        _uiState.update { it.copy(showRealizedBalanceSheet = true) }
    }

    fun hideRealizedBalance() {
        _uiState.update { it.copy(showRealizedBalanceSheet = false) }
    }

    fun onTransactionAdded(transaction: Transaction) {
        _uiState.update {
            it.copy(
                transactions = it.transactions + transaction,
                showAddTransactionSheet = false
            )
        }
    }
}
