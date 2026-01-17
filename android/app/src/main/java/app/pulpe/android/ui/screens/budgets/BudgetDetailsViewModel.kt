package app.pulpe.android.ui.screens.budgets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.BudgetLineRepository
import app.pulpe.android.data.repository.BudgetRepository
import app.pulpe.android.data.repository.TransactionRepository
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
    val showAddTransactionSheet: Boolean = false,
    val selectedBudgetLineForDetails: BudgetLine? = null,
    val selectedTransactionForEdit: Transaction? = null,
    val transactionToDelete: Transaction? = null,
    val isTransactionOperationLoading: Boolean = false,
    val transactionOperationError: String? = null,
    val selectedBudgetLineForEdit: BudgetLine? = null,
    val budgetLineToDelete: BudgetLine? = null,
    val isBudgetLineOperationLoading: Boolean = false,
    val budgetLineOperationError: String? = null
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

    fun getAllocatedTransactions(budgetLineId: String): List<Transaction> {
        return transactions.filter { it.budgetLineId == budgetLineId }
    }
}

@HiltViewModel
class BudgetDetailsViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository,
    private val transactionRepository: TransactionRepository,
    private val budgetLineRepository: BudgetLineRepository
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

    fun onTransactionAdded(transaction: Transaction) {
        _uiState.update { state ->
            state.copy(
                showAddTransactionSheet = false,
                transactions = (state.transactions + transaction)
                    .sortedByDescending { it.transactionDate }
            )
        }
    }

    // Budget Line Details Sheet
    fun showBudgetLineDetails(budgetLine: BudgetLine) {
        _uiState.update { it.copy(selectedBudgetLineForDetails = budgetLine) }
    }

    fun hideBudgetLineDetails() {
        _uiState.update { it.copy(selectedBudgetLineForDetails = null) }
    }

    // Edit Transaction Sheet
    fun showEditTransaction(transaction: Transaction) {
        _uiState.update { it.copy(selectedTransactionForEdit = transaction) }
    }

    fun hideEditTransaction() {
        _uiState.update { it.copy(selectedTransactionForEdit = null, transactionOperationError = null) }
    }

    fun updateTransaction(transactionId: String, update: TransactionUpdate) {
        viewModelScope.launch {
            _uiState.update { it.copy(isTransactionOperationLoading = true, transactionOperationError = null) }

            val result = transactionRepository.updateTransaction(transactionId, update)

            result.fold(
                onSuccess = { updatedTransaction ->
                    _uiState.update { state ->
                        state.copy(
                            isTransactionOperationLoading = false,
                            selectedTransactionForEdit = null,
                            transactions = state.transactions.map { tx ->
                                if (tx.id == transactionId) updatedTransaction else tx
                            }.sortedByDescending { it.transactionDate }
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isTransactionOperationLoading = false,
                            transactionOperationError = error.message ?: "Erreur lors de la mise à jour"
                        )
                    }
                }
            )
        }
    }

    // Delete Transaction Confirmation
    fun showDeleteConfirmation(transaction: Transaction) {
        _uiState.update { it.copy(transactionToDelete = transaction) }
    }

    fun hideDeleteConfirmation() {
        _uiState.update { it.copy(transactionToDelete = null, transactionOperationError = null) }
    }

    fun confirmDeleteTransaction() {
        val transaction = _uiState.value.transactionToDelete ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isTransactionOperationLoading = true, transactionOperationError = null) }

            val result = transactionRepository.deleteTransaction(transaction.id)

            result.fold(
                onSuccess = {
                    _uiState.update { state ->
                        state.copy(
                            isTransactionOperationLoading = false,
                            transactionToDelete = null,
                            transactions = state.transactions.filter { it.id != transaction.id }
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isTransactionOperationLoading = false,
                            transactionOperationError = error.message ?: "Erreur lors de la suppression"
                        )
                    }
                }
            )
        }
    }

    // Toggle Transaction Check
    fun toggleTransactionCheck(transaction: Transaction) {
        viewModelScope.launch {
            // Optimistic update
            _uiState.update { state ->
                state.copy(
                    transactions = state.transactions.map { tx ->
                        if (tx.id == transaction.id) tx.toggled() else tx
                    }
                )
            }

            val result = transactionRepository.toggleCheck(transaction.id)

            result.fold(
                onSuccess = { updatedTransaction ->
                    _uiState.update { state ->
                        state.copy(
                            transactions = state.transactions.map { tx ->
                                if (tx.id == transaction.id) updatedTransaction else tx
                            }
                        )
                    }
                },
                onFailure = {
                    // Rollback on error
                    _uiState.update { state ->
                        state.copy(
                            transactions = state.transactions.map { tx ->
                                if (tx.id == transaction.id) transaction else tx
                            }
                        )
                    }
                }
            )
        }
    }

    fun clearTransactionOperationError() {
        _uiState.update { it.copy(transactionOperationError = null) }
    }

    // Budget Line Edit Sheet
    fun showEditBudgetLine(budgetLine: BudgetLine) {
        _uiState.update { it.copy(selectedBudgetLineForEdit = budgetLine) }
    }

    fun hideEditBudgetLine() {
        _uiState.update { it.copy(selectedBudgetLineForEdit = null, budgetLineOperationError = null) }
    }

    fun updateBudgetLine(update: BudgetLineUpdate) {
        viewModelScope.launch {
            _uiState.update { it.copy(isBudgetLineOperationLoading = true, budgetLineOperationError = null) }

            val result = budgetLineRepository.updateBudgetLine(update.id, update)

            result.fold(
                onSuccess = { updatedLine ->
                    _uiState.update { state ->
                        state.copy(
                            isBudgetLineOperationLoading = false,
                            selectedBudgetLineForEdit = null,
                            selectedBudgetLineForDetails = null,
                            budgetLines = state.budgetLines.map { line ->
                                if (line.id == update.id) updatedLine else line
                            }
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isBudgetLineOperationLoading = false,
                            budgetLineOperationError = error.message ?: "Erreur lors de la mise à jour"
                        )
                    }
                }
            )
        }
    }

    // Budget Line Delete Confirmation
    fun showDeleteBudgetLineConfirmation(budgetLine: BudgetLine) {
        _uiState.update { it.copy(budgetLineToDelete = budgetLine) }
    }

    fun hideDeleteBudgetLineConfirmation() {
        _uiState.update { it.copy(budgetLineToDelete = null, budgetLineOperationError = null) }
    }

    fun confirmDeleteBudgetLine() {
        val budgetLine = _uiState.value.budgetLineToDelete ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isBudgetLineOperationLoading = true, budgetLineOperationError = null) }

            val result = budgetLineRepository.deleteBudgetLine(budgetLine.id)

            result.fold(
                onSuccess = {
                    _uiState.update { state ->
                        state.copy(
                            isBudgetLineOperationLoading = false,
                            budgetLineToDelete = null,
                            selectedBudgetLineForDetails = null,
                            budgetLines = state.budgetLines.filter { it.id != budgetLine.id },
                            transactions = state.transactions.filter { it.budgetLineId != budgetLine.id }
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isBudgetLineOperationLoading = false,
                            budgetLineOperationError = error.message ?: "Erreur lors de la suppression"
                        )
                    }
                }
            )
        }
    }

    // Budget Line Toggle Check
    fun toggleBudgetLineCheck(budgetLine: BudgetLine) {
        viewModelScope.launch {
            // Optimistic update
            _uiState.update { state ->
                state.copy(
                    budgetLines = state.budgetLines.map { line ->
                        if (line.id == budgetLine.id) line.toggled() else line
                    }
                )
            }

            val result = budgetLineRepository.toggleCheck(budgetLine.id)

            result.fold(
                onSuccess = { updatedLine ->
                    _uiState.update { state ->
                        state.copy(
                            budgetLines = state.budgetLines.map { line ->
                                if (line.id == budgetLine.id) updatedLine else line
                            }
                        )
                    }
                },
                onFailure = {
                    // Rollback on error
                    _uiState.update { state ->
                        state.copy(
                            budgetLines = state.budgetLines.map { line ->
                                if (line.id == budgetLine.id) budgetLine else line
                            }
                        )
                    }
                }
            )
        }
    }

    fun clearBudgetLineOperationError() {
        _uiState.update { it.copy(budgetLineOperationError = null) }
    }
}
