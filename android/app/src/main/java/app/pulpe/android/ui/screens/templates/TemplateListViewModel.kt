package app.pulpe.android.ui.screens.templates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.TemplateRepository
import app.pulpe.android.domain.model.BudgetTemplate
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TemplateListUiState(
    val templates: List<BudgetTemplate> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class TemplateListViewModel @Inject constructor(
    private val templateRepository: TemplateRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TemplateListUiState())
    val uiState: StateFlow<TemplateListUiState> = _uiState.asStateFlow()

    fun loadTemplates() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            templateRepository.getTemplates().fold(
                onSuccess = { templates ->
                    val sorted = templates.sortedByDescending { it.isDefault }
                    _uiState.update { it.copy(isLoading = false, templates = sorted) }
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
}
