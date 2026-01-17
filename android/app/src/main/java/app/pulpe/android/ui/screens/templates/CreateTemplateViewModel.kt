package app.pulpe.android.ui.screens.templates

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.TemplateRepository
import app.pulpe.android.domain.model.BudgetTemplateCreate
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CreateTemplateUiState(
    val name: String = "",
    val description: String = "",
    val isDefault: Boolean = false,
    val nameError: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val createdTemplateId: String? = null
)

@HiltViewModel
class CreateTemplateViewModel @Inject constructor(
    private val templateRepository: TemplateRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CreateTemplateUiState())
    val uiState: StateFlow<CreateTemplateUiState> = _uiState.asStateFlow()

    fun setName(name: String) {
        _uiState.update {
            it.copy(
                name = name,
                nameError = if (name.isBlank()) "Le nom est requis" else null
            )
        }
    }

    fun setDescription(description: String) {
        _uiState.update { it.copy(description = description) }
    }

    fun setIsDefault(isDefault: Boolean) {
        _uiState.update { it.copy(isDefault = isDefault) }
    }

    fun createTemplate() {
        val state = _uiState.value

        if (state.name.isBlank()) {
            _uiState.update { it.copy(nameError = "Le nom est requis") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            val templateCreate = BudgetTemplateCreate(
                name = state.name,
                description = state.description.ifBlank { null },
                isDefault = state.isDefault
            )

            templateRepository.createTemplate(templateCreate).fold(
                onSuccess = { data ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            createdTemplateId = data.template.id
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
