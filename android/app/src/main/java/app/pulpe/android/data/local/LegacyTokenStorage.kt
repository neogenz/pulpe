package app.pulpe.android.data.local

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Legacy storage wrapper for migrating tokens from EncryptedSharedPreferences to DataStore + Tink.
 * This class is only used during migration and will be removed in a future release.
 */
@Singleton
class LegacyTokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val TAG = "LegacyTokenStorage"
        private const val PREFS_NAME = "pulpe_secure_tokens"
        private const val ACCESS_TOKEN_KEY = "access_token"
        private const val REFRESH_TOKEN_KEY = "refresh_token"
    }

    private val encryptedPrefs: SharedPreferences? by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                PREFS_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            Log.w(TAG, "Failed to initialize legacy encrypted prefs", e)
            null
        }
    }

    fun hasLegacyTokens(): Boolean {
        return encryptedPrefs?.contains(ACCESS_TOKEN_KEY) == true
    }

    fun getAccessToken(): String? {
        return encryptedPrefs?.getString(ACCESS_TOKEN_KEY, null)
    }

    fun getRefreshToken(): String? {
        return encryptedPrefs?.getString(REFRESH_TOKEN_KEY, null)
    }

    fun clearLegacyTokens() {
        encryptedPrefs?.edit()
            ?.remove(ACCESS_TOKEN_KEY)
            ?.remove(REFRESH_TOKEN_KEY)
            ?.apply()
    }
}
