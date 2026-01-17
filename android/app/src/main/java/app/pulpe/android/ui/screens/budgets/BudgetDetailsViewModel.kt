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

sealed class SheetState {
    data object Hidden : SheetState()
    data object AddTransaction : SheetState()
    data class EditTransaction(val transaction: Transaction) : SheetState()
    data class EditBudgetLine(val budgetLine: BudgetLine) : SheetState()
    data class BudgetLineDetails(val budgetLine: BudgetLine) : SheetState()
}

sealed class DialogState {
    data object Hidden : DialogState()
    data class DeleteTransaction(val transaction: Transaction) : DialogState()
    data class DeleteBudgetLine(val budgetLine: BudgetLine) : DialogState()
}

data class OperationState(
    val isLoading: Boolean = false,
    val error: String? = null
)

data class BudgetDetailsUiState(
    val budget: Budget? = null,
    val budgetLines: List<BudgetLine> = emptyList(),
    val transactions: List<Transaction> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    // Consolidated sheet/dialog/operation states
    val sheetState: SheetState = SheetState.Hidden,
    val dialogState: DialogState = DialogState.Hidden,
    val operationState: OperationState = OperationState(),
    // Pre-computed values
    val metrics: BudgetFormulas.Metrics = BudgetFormulas.Metrics.EMPTY,
    val displayBudgetLines: List<BudgetLine> = emptyList(),
    val recurringBudgetLines: List<BudgetLine> = emptyList(),
    val oneOffBudgetLines: List<BudgetLine> = emptyList()
) {
    // Backward compatibility accessors
    val showAddTransactionSheet: Boolean get() = sheetState is SheetState.AddTransaction
    val selectedBudgetLineForDetails: BudgetLine? get() = (sheetState as? SheetState.BudgetLineDetails)?.budgetLine
    val selectedTransactionForEdit: Transaction? get() = (sheetState as? SheetState.EditTransaction)?.transaction
    val selectedBudgetLineForEdit: BudgetLine? get() = (sheetState as? SheetState.EditBudgetLine)?.budgetLine
    val transactionToDelete: Transaction? get() = (dialogState as? DialogState.DeleteTransaction)?.transaction
    val budgetLineToDelete: BudgetLine? get() = (dialogState as? DialogState.DeleteBudgetLine)?.budgetLine
    val isTransactionOperationLoading: Boolean get() = operationState.isLoading && (sheetState is SheetState.EditTransaction || dialogState is DialogState.DeleteTransaction)
    val isBudgetLineOperationLoading: Boolean get() = operationState.isLoading && (sheetState is SheetState.EditBudgetLine || dialogState is DialogState.DeleteBudgetLine)
    val transactionOperationError: String? get() = if (sheetState is SheetState.EditTransaction || dialogState is DialogState.DeleteTransaction) operationState.error else null
    val budgetLineOperationError: String? get() = if (sheetState is SheetState.EditBudgetLine || dialogState is DialogState.DeleteBudgetLine) operationState.error else null
    fun getConsumption(line: BudgetLine): BudgetFormulas.Consumption {
        return BudgetFormulas.calculateConsumption(line, transactions)
    }

    fun getAllocatedTransactions(budgetLineId: String): List<Transaction> {
        return transactions.filter { it.budgetLineId == budgetLineId }
    }

    companion object {
        fun computeValues(
            budget: Budget?,
            budgetLines: List<BudgetLine>,
            transactions: List<Transaction>
        ): BudgetDetailsUiState {
            val metrics = BudgetFormulas.calculateAllMetrics(
                budgetLines = budgetLines,
                transactions = transactions,
                rollover = budget?.rolloverOrZero ?: BigDecimal.ZERO
            )

            val displayBudgetLines = buildList {
                val rollover = budget?.rollover ?: 0.0
                if (rollover != 0.0) {
                    add(
                        BudgetLine.rolloverLine(
                            amount = BigDecimal(rollover),
                            budgetId = budget?.id ?: "",
                            sourceBudgetId = budget?.previousBudgetId
                        )
                    )
                }
                addAll(budgetLines)
            }

            val recurringBudgetLines = displayBudgetLines
                .filter { it.recurrence == TransactionRecurrence.FIXED }
                .sortedByDescending { it.createdAt }

            val oneOffBudgetLines = displayBudgetLines
                .filter { it.recurrence == TransactionRecurrence.ONE_OFF && it.isRollover != true }
                .sortedByDescending { it.createdAt }

            return BudgetDetailsUiState(
                budget = budget,
                budgetLines = budgetLines,
                transactions = transactions.sortedByDescending { it.transactionDate },
                metrics = metrics,
                displayBudgetLines = displayBudgetLines,
                recurringBudgetLines = recurringBudgetLines,
                oneOffBudgetLines = oneOffBudgetLines
            )
        }
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
                    val computed = BudgetDetailsUiState.computeValues(
                        budget = details.budget,
                        budgetLines = details.budgetLines,
                        transactions = details.transactions
                    )
                    _uiState.update { computed.copy(isLoading = false) }
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
        _uiState.update { it.copy(sheetState = SheetState.AddTransaction) }
    }

    fun hideAddTransaction() {
        _uiState.update { it.copy(sheetState = SheetState.Hidden) }
    }

    fun onTransactionAdded(transaction: Transaction) {
        _uiState.update { state ->
            val newTransactions = state.transactions + transaction
            val computed = BudgetDetailsUiState.computeValues(
                budget = state.budget,
                budgetLines = state.budgetLines,
                transactions = newTransactions
            )
            computed.copy(sheetState = SheetState.Hidden)
        }
    }

    // Budget Line Details Sheet
    fun showBudgetLineDetails(budgetLine: BudgetLine) {
        _uiState.update { it.copy(sheetState = SheetState.BudgetLineDetails(budgetLine)) }
    }

    fun hideBudgetLineDetails() {
        _uiState.update { it.copy(sheetState = SheetState.Hidden) }
    }

    // Edit Transaction Sheet
    fun showEditTransaction(transaction: Transaction) {
        _uiState.update { it.copy(sheetState = SheetState.EditTransaction(transaction)) }
    }

    fun hideEditTransaction() {
        _uiState.update { it.copy(sheetState = SheetState.Hidden, operationState = OperationState()) }
    }

    fun updateTransaction(transactionId: String, update: TransactionUpdate) {
        viewModelScope.launch {
            _uiState.update { it.copy(operationState = OperationState(isLoading = true)) }

            val result = transactionRepository.updateTransaction(transactionId, update)

            result.fold(
                onSuccess = { updatedTransaction ->
                    _uiState.update { state ->
                        val newTransactions = state.transactions.map { tx ->
                            if (tx.id == transactionId) updatedTransaction else tx
                        }
                        val computed = BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = state.budgetLines,
                            transactions = newTransactions
                        )
                        computed.copy(
                            sheetState = SheetState.Hidden,
                            operationState = OperationState()
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(operationState = OperationState(error = error.message ?: "Erreur lors de la mise à jour"))
                    }
                }
            )
        }
    }

    // Delete Transaction Confirmation
    fun showDeleteConfirmation(transaction: Transaction) {
        _uiState.update { it.copy(dialogState = DialogState.DeleteTransaction(transaction)) }
    }

    fun hideDeleteConfirmation() {
        _uiState.update { it.copy(dialogState = DialogState.Hidden, operationState = OperationState()) }
    }

    fun confirmDeleteTransaction() {
        val transaction = (_uiState.value.dialogState as? DialogState.DeleteTransaction)?.transaction ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(operationState = OperationState(isLoading = true)) }

            val result = transactionRepository.deleteTransaction(transaction.id)

            result.fold(
                onSuccess = {
                    _uiState.update { state ->
                        val newTransactions = state.transactions.filter { it.id != transaction.id }
                        val computed = BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = state.budgetLines,
                            transactions = newTransactions
                        )
                        computed.copy(
                            dialogState = DialogState.Hidden,
                            operationState = OperationState()
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(operationState = OperationState(error = error.message ?: "Erreur lors de la suppression"))
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
                val newTransactions = state.transactions.map { tx ->
                    if (tx.id == transaction.id) tx.toggled() else tx
                }
                val computed = BudgetDetailsUiState.computeValues(
                    budget = state.budget,
                    budgetLines = state.budgetLines,
                    transactions = newTransactions
                )
                computed
            }

            val result = transactionRepository.toggleCheck(transaction.id)

            result.fold(
                onSuccess = { updatedTransaction ->
                    _uiState.update { state ->
                        val newTransactions = state.transactions.map { tx ->
                            if (tx.id == transaction.id) updatedTransaction else tx
                        }
                        BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = state.budgetLines,
                            transactions = newTransactions
                        )
                    }
                },
                onFailure = {
                    // Rollback on error
                    _uiState.update { state ->
                        val newTransactions = state.transactions.map { tx ->
                            if (tx.id == transaction.id) transaction else tx
                        }
                        BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = state.budgetLines,
                            transactions = newTransactions
                        )
                    }
                }
            )
        }
    }

    fun clearTransactionOperationError() {
        _uiState.update { it.copy(operationState = OperationState()) }
    }

    // Budget Line Edit Sheet
    fun showEditBudgetLine(budgetLine: BudgetLine) {
        _uiState.update { it.copy(sheetState = SheetState.EditBudgetLine(budgetLine)) }
    }

    fun hideEditBudgetLine() {
        _uiState.update { it.copy(sheetState = SheetState.Hidden, operationState = OperationState()) }
    }

    fun updateBudgetLine(update: BudgetLineUpdate) {
        viewModelScope.launch {
            _uiState.update { it.copy(operationState = OperationState(isLoading = true)) }

            val result = budgetLineRepository.updateBudgetLine(update.id, update)

            result.fold(
                onSuccess = { updatedLine ->
                    _uiState.update { state ->
                        val newBudgetLines = state.budgetLines.map { line ->
                            if (line.id == update.id) updatedLine else line
                        }
                        val computed = BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = newBudgetLines,
                            transactions = state.transactions
                        )
                        computed.copy(
                            sheetState = SheetState.Hidden,
                            operationState = OperationState()
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(operationState = OperationState(error = error.message ?: "Erreur lors de la mise à jour"))
                    }
                }
            )
        }
    }

    // Budget Line Delete Confirmation
    fun showDeleteBudgetLineConfirmation(budgetLine: BudgetLine) {
        _uiState.update { it.copy(dialogState = DialogState.DeleteBudgetLine(budgetLine)) }
    }

    fun hideDeleteBudgetLineConfirmation() {
        _uiState.update { it.copy(dialogState = DialogState.Hidden, operationState = OperationState()) }
    }

    fun confirmDeleteBudgetLine() {
        val budgetLine = (_uiState.value.dialogState as? DialogState.DeleteBudgetLine)?.budgetLine ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(operationState = OperationState(isLoading = true)) }

            val result = budgetLineRepository.deleteBudgetLine(budgetLine.id)

            result.fold(
                onSuccess = {
                    _uiState.update { state ->
                        val newBudgetLines = state.budgetLines.filter { it.id != budgetLine.id }
                        val newTransactions = state.transactions.filter { it.budgetLineId != budgetLine.id }
                        val computed = BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = newBudgetLines,
                            transactions = newTransactions
                        )
                        computed.copy(
                            dialogState = DialogState.Hidden,
                            sheetState = SheetState.Hidden,
                            operationState = OperationState()
                        )
                    }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(operationState = OperationState(error = error.message ?: "Erreur lors de la suppression"))
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
                val newBudgetLines = state.budgetLines.map { line ->
                    if (line.id == budgetLine.id) line.toggled() else line
                }
                BudgetDetailsUiState.computeValues(
                    budget = state.budget,
                    budgetLines = newBudgetLines,
                    transactions = state.transactions
                )
            }

            val result = budgetLineRepository.toggleCheck(budgetLine.id)

            result.fold(
                onSuccess = { updatedLine ->
                    _uiState.update { state ->
                        val newBudgetLines = state.budgetLines.map { line ->
                            if (line.id == budgetLine.id) updatedLine else line
                        }
                        BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = newBudgetLines,
                            transactions = state.transactions
                        )
                    }
                },
                onFailure = {
                    // Rollback on error
                    _uiState.update { state ->
                        val newBudgetLines = state.budgetLines.map { line ->
                            if (line.id == budgetLine.id) budgetLine else line
                        }
                        BudgetDetailsUiState.computeValues(
                            budget = state.budget,
                            budgetLines = newBudgetLines,
                            transactions = state.transactions
                        )
                    }
                }
            )
        }
    }

    fun clearBudgetLineOperationError() {
        _uiState.update { it.copy(operationState = OperationState()) }
    }
}
