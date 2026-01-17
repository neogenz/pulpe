package app.pulpe.android.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pulpe.android.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val email: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val isLoggedIn: Boolean = false,
    val errorMessage: String? = null
) {
    val isEmailValid: Boolean
        get() = email.contains("@") && email.contains(".")

    val isPasswordValid: Boolean
        get() = password.length >= 8

    val canSubmit: Boolean
        get() = isEmailValid && isPasswordValid && !isLoading
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun updateEmail(email: String) {
        _uiState.update { it.copy(email = email, errorMessage = null) }
    }

    fun updatePassword(password: String) {
        _uiState.update { it.copy(password = password, errorMessage = null) }
    }

    fun login() {
        if (!_uiState.value.canSubmit) return

        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, errorMessage = null) }

            val result = authRepository.login(
                email = _uiState.value.email.trim(),
                password = _uiState.value.password
            )

            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isLoading = false, isLoggedIn = true) }
                },
                onFailure = { error ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = localizeError(error)
                        )
                    }
                }
            )
        }
    }

    private fun localizeError(error: Throwable): String {
        val message = error.message ?: return "Une erreur inattendue s'est produite"

        return when {
            message.contains("invalid_credentials", ignoreCase = true) ||
            message.contains("Invalid login credentials", ignoreCase = true) ->
                "Email ou mot de passe incorrect — on réessaie ?"

            message.contains("email_not_confirmed", ignoreCase = true) ->
                "Confirme ton email avant de te connecter"

            message.contains("network", ignoreCase = true) ||
            message.contains("connection", ignoreCase = true) ->
                "Problème de connexion — vérifie ta connexion internet"

            message.contains("timeout", ignoreCase = true) ->
                "La requête a pris trop de temps — réessaie"

            else -> "Quelque chose n'a pas fonctionné — réessayons"
        }
    }
}
