package app.pulpe.android.ui.screens.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.TemplateRepository
import app.pulpe.android.domain.model.BudgetTemplateCreateFromOnboarding
import app.pulpe.android.domain.model.OnboardingTransaction
import app.pulpe.android.domain.model.TransactionKind
import app.pulpe.android.domain.model.TransactionRecurrence
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.math.BigDecimal
import javax.inject.Inject

data class OnboardingLine(
    val name: String,
    val amount: BigDecimal,
    val recurrence: TransactionRecurrence
)

data class OnboardingUiState(
    val currentStep: Int = 0,
    val incomeLines: List<OnboardingLine> = emptyList(),
    val expenseLines: List<OnboardingLine> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val isComplete: Boolean = false
)

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val templateRepository: TemplateRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

    fun nextStep() {
        _uiState.update { it.copy(currentStep = it.currentStep + 1) }
    }

    fun previousStep() {
        _uiState.update { it.copy(currentStep = maxOf(0, it.currentStep - 1)) }
    }

    fun addIncomeLine(name: String, amount: BigDecimal, recurrence: TransactionRecurrence) {
        _uiState.update {
            it.copy(incomeLines = it.incomeLines + OnboardingLine(name, amount, recurrence))
        }
    }

    fun removeIncomeLine(index: Int) {
        _uiState.update {
            it.copy(incomeLines = it.incomeLines.filterIndexed { i, _ -> i != index })
        }
    }

    fun addExpenseLine(name: String, amount: BigDecimal, recurrence: TransactionRecurrence) {
        _uiState.update {
            it.copy(expenseLines = it.expenseLines + OnboardingLine(name, amount, recurrence))
        }
    }

    fun removeExpenseLine(index: Int) {
        _uiState.update {
            it.copy(expenseLines = it.expenseLines.filterIndexed { i, _ -> i != index })
        }
    }

    fun complete() {
        val state = _uiState.value

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val customTransactions = buildList {
                state.incomeLines.forEach { line ->
                    add(
                        OnboardingTransaction(
                            amount = line.amount.toDouble(),
                            type = TransactionKind.INCOME,
                            name = line.name,
                            description = null,
                            expenseType = line.recurrence,
                            isRecurring = line.recurrence == TransactionRecurrence.FIXED
                        )
                    )
                }
                state.expenseLines.forEach { line ->
                    add(
                        OnboardingTransaction(
                            amount = line.amount.toDouble(),
                            type = TransactionKind.EXPENSE,
                            name = line.name,
                            description = null,
                            expenseType = line.recurrence,
                            isRecurring = line.recurrence == TransactionRecurrence.FIXED
                        )
                    )
                }
            }

            val onboardingData = BudgetTemplateCreateFromOnboarding(
                name = "Mon modèle",
                description = "Créé lors de l'onboarding",
                isDefault = true,
                customTransactions = customTransactions
            )

            templateRepository.createTemplateFromOnboarding(onboardingData).fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false, isComplete = true) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Erreur lors de la création"
                        )
                    }
                }
            )
        }
    }
}
