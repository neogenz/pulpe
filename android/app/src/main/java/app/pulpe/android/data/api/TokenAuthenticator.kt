package app.pulpe.android.data.api

import app.pulpe.android.data.local.TokenStorage
import app.pulpe.android.data.repository.AuthRepository
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject
import javax.inject.Provider

class TokenAuthenticator @Inject constructor(
    private val authRepositoryProvider: Provider<AuthRepository>,
    private val tokenStorage: TokenStorage
) : Authenticator {

    companion object {
        private const val MAX_RETRY_COUNT = 1
    }

    override fun authenticate(route: Route?, response: Response): Request? {
        if (retryCount(response) >= MAX_RETRY_COUNT) {
            return null
        }

        if (response.code != 401) {
            return null
        }

        synchronized(this) {
            val currentToken = tokenStorage.getAccessTokenSync()
            val requestToken = response.request.header("Authorization")?.removePrefix("Bearer ")

            // Token was already refreshed by another request
            if (currentToken != null && currentToken != requestToken) {
                return response.request.newBuilder()
                    .header("Authorization", "Bearer $currentToken")
                    .build()
            }

            // Attempt to refresh token
            val newToken = runBlocking {
                authRepositoryProvider.get().refreshToken().getOrNull()
            }

            return if (newToken != null) {
                response.request.newBuilder()
                    .header("Authorization", "Bearer $newToken")
                    .build()
            } else {
                // Refresh failed - clear tokens to force re-login
                runBlocking {
                    tokenStorage.clearTokens()
                }
                null
            }
        }
    }

    private fun retryCount(response: Response): Int {
        var count = 0
        var priorResponse = response.priorResponse
        while (priorResponse != null) {
            count++
            priorResponse = priorResponse.priorResponse
        }
        return count
    }
}
