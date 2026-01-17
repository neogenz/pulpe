package app.pulpe.android.ui.screens.budgets

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.BudgetRepository
import app.pulpe.android.data.repository.TemplateRepository
import app.pulpe.android.domain.model.BudgetCreate
import app.pulpe.android.domain.model.BudgetTemplate
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class CreateBudgetUiState(
    val month: Int = LocalDate.now().monthValue,
    val year: Int = LocalDate.now().year,
    val description: String = "",
    val selectedTemplateId: String? = null,
    val availableTemplates: List<BudgetTemplate> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val createdBudgetId: String? = null
)

@HiltViewModel
class CreateBudgetViewModel @Inject constructor(
    private val budgetRepository: BudgetRepository,
    private val templateRepository: TemplateRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateBudgetUiState())
    val uiState: StateFlow<CreateBudgetUiState> = _uiState.asStateFlow()

    init {
        loadTemplates()
    }

    private fun loadTemplates() {
        viewModelScope.launch {
            templateRepository.getTemplates().fold(
                onSuccess = { templates ->
                    _uiState.update {
                        it.copy(
                            availableTemplates = templates,
                            selectedTemplateId = templates.find { t -> t.isDefaultTemplate }?.id ?: templates.firstOrNull()?.id
                        )
                    }
                },
                onFailure = { /* Templates are optional, ignore errors */ }
            )
        }
    }

    fun setMonth(month: Int) {
        _uiState.update { it.copy(month = month) }
    }

    fun setYear(year: Int) {
        _uiState.update { it.copy(year = year) }
    }

    fun setDescription(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun selectTemplate(templateId: String?) {
        _uiState.update { it.copy(selectedTemplateId = templateId) }
    }

    fun createBudget() {
        val state = _uiState.value

        val templateId = state.selectedTemplateId
        if (templateId == null) {
            _uiState.update { it.copy(error = "Veuillez sélectionner un modèle") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val budgetCreate = BudgetCreate(
                month = state.month,
                year = state.year,
                description = state.description,
                templateId = templateId
            )

            budgetRepository.createBudget(budgetCreate).fold(
                onSuccess = { budget ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            createdBudgetId = budget.id
                        )
                    }
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
