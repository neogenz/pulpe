package app.pulpe.android.data.local

import android.content.Context
import android.util.Log
import androidx.datastore.core.DataStore
import androidx.datastore.dataStore
import com.google.crypto.tink.Aead
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

private val Context.tokenDataStore: DataStore<TokenData> by dataStore(
    fileName = "pulpe_tokens.pb",
    serializer = null!! // Injected at runtime
)

@Singleton
class SecureTokenStorage @Inject constructor(
    @ApplicationContext private val context: Context,
    aead: Aead,
    private val legacyTokenStorage: LegacyTokenStorage
) {
    companion object {
        private const val TAG = "SecureTokenStorage"
        private const val DATASTORE_FILE = "pulpe_tokens.pb"
    }

    private val serializer = EncryptedTokenSerializer(aead)

    private val dataStore: DataStore<TokenData> = androidx.datastore.core.DataStoreFactory.create(
        serializer = serializer,
        produceFile = { context.filesDir.resolve(DATASTORE_FILE) }
    )

    private val _accessTokenFlow = MutableStateFlow<String?>(null)
    val accessTokenFlow: StateFlow<String?> = _accessTokenFlow.asStateFlow()

    @Volatile
    private var cachedAccessToken: String? = null

    private var migrationCompleted = false

    fun getAccessTokenSync(): String? = cachedAccessToken

    suspend fun init() {
        migrateFromLegacyIfNeeded()
        val tokenData = dataStore.data.first()
        cachedAccessToken = tokenData.accessToken
        _accessTokenFlow.value = tokenData.accessToken
    }

    private suspend fun migrateFromLegacyIfNeeded() {
        if (migrationCompleted) return

        if (legacyTokenStorage.hasLegacyTokens()) {
            Log.i(TAG, "Migrating tokens from legacy storage")
            val accessToken = legacyTokenStorage.getAccessToken()
            val refreshToken = legacyTokenStorage.getRefreshToken()

            if (accessToken != null) {
                dataStore.updateData { currentData ->
                    currentData.copy(
                        accessToken = accessToken,
                        refreshToken = refreshToken
                    )
                }
                legacyTokenStorage.clearLegacyTokens()
                Log.i(TAG, "Migration completed successfully")
            }
        }

        migrationCompleted = true
    }

    suspend fun saveTokens(accessToken: String, refreshToken: String) {
        dataStore.updateData { currentData ->
            currentData.copy(
                accessToken = accessToken,
                refreshToken = refreshToken
            )
        }
        cachedAccessToken = accessToken
        _accessTokenFlow.value = accessToken
    }

    suspend fun getAccessToken(): String? {
        return dataStore.data.first().accessToken
    }

    suspend fun getRefreshToken(): String? {
        return dataStore.data.first().refreshToken
    }

    suspend fun hasTokens(): Boolean {
        return getAccessToken() != null
    }

    suspend fun clearTokens() {
        dataStore.updateData { TokenData() }
        cachedAccessToken = null
        _accessTokenFlow.value = null
    }

    fun updateCachedToken(token: String?) {
        cachedAccessToken = token
        _accessTokenFlow.value = token
    }
}
