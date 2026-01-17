package app.pulpe.android.ui.screens.budgets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.TransactionRepository
import app.pulpe.android.domain.model.BudgetLine
import app.pulpe.android.domain.model.Transaction
import app.pulpe.android.domain.model.TransactionCreate
import app.pulpe.android.domain.model.TransactionKind
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AddAllocatedTransactionUiState(
    val budgetLine: BudgetLine? = null,
    val name: String = "",
    val amountText: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val savedTransaction: Transaction? = null
) {
    val amount: Double?
        get() = amountText.replace(",", ".").toDoubleOrNull()

    val canSave: Boolean
        get() = name.isNotBlank() && amount != null && amount!! > 0 && budgetLine != null
}

@HiltViewModel
class AddAllocatedTransactionViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AddAllocatedTransactionUiState())
    val uiState: StateFlow<AddAllocatedTransactionUiState> = _uiState.asStateFlow()

    fun setBudgetLine(budgetLine: BudgetLine) {
        _uiState.update { it.copy(budgetLine = budgetLine) }
    }

    fun updateName(name: String) {
        _uiState.update { it.copy(name = name, error = null) }
    }

    fun updateAmount(amount: String) {
        val filtered = amount.filter { it.isDigit() || it == '.' || it == ',' }
        _uiState.update { it.copy(amountText = filtered, error = null) }
    }

    fun save() {
        val state = _uiState.value
        if (!state.canSave) return

        val budgetLine = state.budgetLine ?: return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val transactionCreate = TransactionCreate(
                budgetId = budgetLine.budgetId,
                budgetLineId = budgetLine.id,
                name = state.name.trim(),
                amount = state.amount!!,
                kind = budgetLine.kind,
                transactionDate = java.time.Instant.now().toString()
            )

            val result = transactionRepository.createTransaction(transactionCreate)

            result.fold(
                onSuccess = { transaction ->
                    _uiState.update { it.copy(isLoading = false, savedTransaction = transaction) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "La sauvegarde n'a pas abouti — on retente ?"
                        )
                    }
                }
            )
        }
    }
}
