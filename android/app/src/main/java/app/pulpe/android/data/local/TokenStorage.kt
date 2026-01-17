package app.pulpe.android.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val PREFS_NAME = "pulpe_secure_tokens"
        private const val ACCESS_TOKEN_KEY = "access_token"
        private const val REFRESH_TOKEN_KEY = "refresh_token"
    }

    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val encryptedPrefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    private val _accessTokenFlow = MutableStateFlow(encryptedPrefs.getString(ACCESS_TOKEN_KEY, null))
    val accessTokenFlow: StateFlow<String?> = _accessTokenFlow.asStateFlow()

    @Volatile
    private var cachedAccessToken: String? = encryptedPrefs.getString(ACCESS_TOKEN_KEY, null)

    fun getAccessTokenSync(): String? = cachedAccessToken

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        encryptedPrefs.edit()
            .putString(ACCESS_TOKEN_KEY, accessToken)
            .putString(REFRESH_TOKEN_KEY, refreshToken)
            .apply()
        cachedAccessToken = accessToken
        _accessTokenFlow.value = accessToken
    }

    suspend fun getAccessToken(): String? {
        return encryptedPrefs.getString(ACCESS_TOKEN_KEY, null)
    }

    suspend fun getRefreshToken(): String? {
        return encryptedPrefs.getString(REFRESH_TOKEN_KEY, null)
    }

    suspend fun hasTokens(): Boolean {
        return getAccessToken() != null
    }

    suspend fun clearTokens() {
        encryptedPrefs.edit()
            .remove(ACCESS_TOKEN_KEY)
            .remove(REFRESH_TOKEN_KEY)
            .apply()
        cachedAccessToken = null
        _accessTokenFlow.value = null
    }

    fun updateCachedToken(token: String?) {
        cachedAccessToken = token
        _accessTokenFlow.value = token
    }
}
