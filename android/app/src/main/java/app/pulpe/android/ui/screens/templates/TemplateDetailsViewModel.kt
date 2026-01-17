package app.pulpe.android.ui.screens.templates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.TemplateRepository
import app.pulpe.android.domain.model.BudgetTemplate
import app.pulpe.android.domain.model.TemplateLine
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TemplateDetailsUiState(
    val template: BudgetTemplate? = null,
    val lines: List<TemplateLine> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val showAddLineSheet: Boolean = false
)

@HiltViewModel
class TemplateDetailsViewModel @Inject constructor(
    private val templateRepository: TemplateRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(TemplateDetailsUiState())
    val uiState: StateFlow<TemplateDetailsUiState> = _uiState.asStateFlow()

    fun loadTemplate(templateId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            // Load template and lines in parallel
            val templateResult = templateRepository.getTemplate(templateId)
            val linesResult = templateRepository.getTemplateLines(templateId)

            templateResult.fold(
                onSuccess = { template ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            template = template,
                            lines = linesResult.getOrDefault(emptyList())
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

    fun showAddLine() {
        _uiState.update { it.copy(showAddLineSheet = true) }
    }

    fun hideAddLine() {
        _uiState.update { it.copy(showAddLineSheet = false) }
    }
}
