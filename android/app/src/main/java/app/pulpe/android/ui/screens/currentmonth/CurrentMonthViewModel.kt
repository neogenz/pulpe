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
    val showRealizedBalanceSheet: Boolean = false,
    // Pre-computed values (updated via computeValues())
    val metrics: BudgetFormulas.Metrics = BudgetFormulas.Metrics.EMPTY,
    val realizedMetrics: BudgetFormulas.RealizedMetrics = BudgetFormulas.RealizedMetrics.EMPTY,
    val daysRemaining: Int = 1,
    val dailyBudget: BigDecimal = BigDecimal.ZERO,
    val alertBudgetLines: List<Pair<BudgetLine, BudgetFormulas.Consumption>> = emptyList(),
    val recentTransactions: List<Transaction> = emptyList(),
    val uncheckedTransactions: List<Transaction> = emptyList()
) {
    companion object {
        fun computeValues(
            budget: Budget?,
            budgetLines: List<BudgetLine>,
            transactions: List<Transaction>
        ): CurrentMonthUiState {
            val metrics = BudgetFormulas.calculateAllMetrics(
                budgetLines = budgetLines,
                transactions = transactions,
                rollover = budget?.rolloverOrZero ?: BigDecimal.ZERO
            )

            val realizedMetrics = BudgetFormulas.calculateRealizedMetrics(
                budgetLines = budgetLines,
                transactions = transactions
            )

            val today = LocalDate.now()
            val endOfMonth = YearMonth.now().atEndOfMonth()
            val daysRemaining = (endOfMonth.dayOfMonth - today.dayOfMonth + 1).coerceAtLeast(1)

            val dailyBudget = if (daysRemaining <= 0 || metrics.remaining <= BigDecimal.ZERO) {
                BigDecimal.ZERO
            } else {
                metrics.remaining.divide(BigDecimal(daysRemaining), 2, java.math.RoundingMode.HALF_UP)
            }

            val alertBudgetLines = budgetLines
                .filter { it.kind.isOutflow && it.isRollover != true }
                .mapNotNull { line ->
                    val consumption = BudgetFormulas.calculateConsumption(line, transactions)
                    if (consumption.percentage >= 80) line to consumption else null
                }
                .sortedByDescending { it.second.percentage }

            val recentTransactions = transactions
                .sortedByDescending { it.transactionDate }
                .take(5)

            val uncheckedTransactions = transactions
                .filter { !it.isChecked }
                .sortedByDescending { it.transactionDate }
                .take(5)

            return CurrentMonthUiState(
                budget = budget,
                budgetLines = budgetLines,
                transactions = transactions,
                metrics = metrics,
                realizedMetrics = realizedMetrics,
                daysRemaining = daysRemaining,
                dailyBudget = dailyBudget,
                alertBudgetLines = alertBudgetLines,
                recentTransactions = recentTransactions,
                uncheckedTransactions = uncheckedTransactions
            )
        }
    }
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
                val computed = CurrentMonthUiState.computeValues(
                    budget = details.budget,
                    budgetLines = details.budgetLines,
                    transactions = details.transactions
                )
                _uiState.update {
                    computed.copy(isLoading = false)
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
        _uiState.update { state ->
            val newTransactions = state.transactions + transaction
            val computed = CurrentMonthUiState.computeValues(
                budget = state.budget,
                budgetLines = state.budgetLines,
                transactions = newTransactions
            )
            computed.copy(showAddTransactionSheet = false)
        }
    }
}
