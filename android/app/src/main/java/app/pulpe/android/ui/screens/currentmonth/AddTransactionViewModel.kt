package app.pulpe.android.ui.screens.currentmonth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.TransactionRepository
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

data class AddTransactionUiState(
    val budgetId: String = "",
    val name: String = "",
    val amountText: String = "",
    val kind: TransactionKind = TransactionKind.EXPENSE,
    val isLoading: Boolean = false,
    val error: String? = null,
    val savedTransaction: Transaction? = null
) {
    val amount: Double?
        get() = amountText.replace(",", ".").toDoubleOrNull()

    val canSave: Boolean
        get() = name.isNotBlank() && amount != null && amount!! > 0 && budgetId.isNotBlank()
}

@HiltViewModel
class AddTransactionViewModel @Inject constructor(
    private val transactionRepository: TransactionRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AddTransactionUiState())
    val uiState: StateFlow<AddTransactionUiState> = _uiState.asStateFlow()

    fun setBudgetId(budgetId: String) {
        _uiState.update { it.copy(budgetId = budgetId) }
    }

    fun updateName(name: String) {
        _uiState.update { it.copy(name = name, error = null) }
    }

    fun updateAmount(amount: String) {
        // Only allow valid decimal input
        val filtered = amount.filter { it.isDigit() || it == '.' || it == ',' }
        _uiState.update { it.copy(amountText = filtered, error = null) }
    }

    fun updateKind(kind: TransactionKind) {
        _uiState.update { it.copy(kind = kind, error = null) }
    }

    fun save() {
        val state = _uiState.value
        if (!state.canSave) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val transactionCreate = TransactionCreate(
                budgetId = state.budgetId,
                name = state.name.trim(),
                amount = state.amount!!,
                kind = state.kind
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
