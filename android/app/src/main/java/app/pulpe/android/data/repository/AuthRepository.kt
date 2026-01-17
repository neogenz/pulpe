package app.pulpe.android.data.repository

import app.pulpe.android.data.api.PulpeApiService
import app.pulpe.android.data.local.SecureTokenStorage
import app.pulpe.android.data.local.UserPreferences
import app.pulpe.android.di.IoDispatcher
import app.pulpe.android.domain.model.UserInfo
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val supabaseClient: SupabaseClient,
    private val apiService: PulpeApiService,
    private val tokenStorage: SecureTokenStorage,
    private val userPreferences: UserPreferences,
    @IoDispatcher private val ioDispatcher: CoroutineDispatcher
) {
    suspend fun login(email: String, password: String): Result<UserInfo> = withContext(ioDispatcher) {
        try {
            supabaseClient.auth.signInWith(Email) {
                this.email = email
                this.password = password
            }

            val session = supabaseClient.auth.currentSessionOrNull()
                ?: return@withContext Result.failure(Exception("Impossible de récupérer la session"))

            tokenStorage.saveTokens(session.accessToken, session.refreshToken ?: "")

            val response = apiService.validateSession()
            if (response.success) {
                userPreferences.setOnboardingCompleted(true)
                Result.success(response.user)
            } else {
                Result.failure(Exception("Validation de la session échouée"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun signUp(email: String, password: String): Result<UserInfo> = withContext(ioDispatcher) {
        try {
            supabaseClient.auth.signUpWith(Email) {
                this.email = email
                this.password = password
            }

            val session = supabaseClient.auth.currentSessionOrNull()
                ?: return@withContext Result.failure(Exception("Impossible de récupérer la session"))

            tokenStorage.saveTokens(session.accessToken, session.refreshToken ?: "")

            val user = session.user
            if (user != null) {
                Result.success(UserInfo(id = user.id, email = user.email ?: email))
            } else {
                Result.failure(Exception("Impossible de récupérer l'utilisateur"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun validateSession(): Result<UserInfo> = withContext(ioDispatcher) {
        try {
            val hasTokens = tokenStorage.hasTokens()
            if (!hasTokens) {
                return@withContext Result.failure(Exception("Aucun token trouvé"))
            }

            val response = apiService.validateSession()
            if (response.success) {
                Result.success(response.user)
            } else {
                Result.failure(Exception("Session invalide"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun logout() = withContext(ioDispatcher) {
        try {
            supabaseClient.auth.signOut()
        } catch (_: Exception) {
            // Ignore errors during logout
        }
        tokenStorage.clearTokens()
    }

    suspend fun isAuthenticated(): Boolean {
        return tokenStorage.hasTokens()
    }

    suspend fun hasCompletedOnboarding(): Boolean {
        return userPreferences.isOnboardingCompleted()
    }

    suspend fun getCurrentUserEmail(): String? {
        return try {
            supabaseClient.auth.currentUserOrNull()?.email
        } catch (_: Exception) {
            null
        }
    }

    suspend fun signOut() {
        logout()
    }

    suspend fun refreshToken(): Result<String> = withContext(ioDispatcher) {
        try {
            supabaseClient.auth.refreshCurrentSession()
            val session = supabaseClient.auth.currentSessionOrNull()
                ?: return@withContext Result.failure(Exception("Impossible de rafraîchir la session"))

            tokenStorage.saveTokens(session.accessToken, session.refreshToken ?: "")
            Result.success(session.accessToken)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
