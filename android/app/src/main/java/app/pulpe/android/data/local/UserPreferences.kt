package app.pulpe.android.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

private val Context.userPrefsDataStore: DataStore<Preferences> by preferencesDataStore(name = "pulpe_user_prefs")

@Singleton
class UserPreferences @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private val ONBOARDING_COMPLETED_KEY = booleanPreferencesKey("onboarding_completed")
        private val TUTORIAL_COMPLETED_KEY = booleanPreferencesKey("tutorial_completed")
        private val BIOMETRIC_ENABLED_KEY = booleanPreferencesKey("biometric_enabled")
    }

    val onboardingCompleted: Flow<Boolean> = context.userPrefsDataStore.data.map { prefs ->
        prefs[ONBOARDING_COMPLETED_KEY] ?: false
    }

    val tutorialCompleted: Flow<Boolean> = context.userPrefsDataStore.data.map { prefs ->
        prefs[TUTORIAL_COMPLETED_KEY] ?: false
    }

    val biometricEnabled: Flow<Boolean> = context.userPrefsDataStore.data.map { prefs ->
        prefs[BIOMETRIC_ENABLED_KEY] ?: false
    }

    suspend fun isOnboardingCompleted(): Boolean {
        return context.userPrefsDataStore.data.map { prefs ->
            prefs[ONBOARDING_COMPLETED_KEY] ?: false
        }.first()
    }

    suspend fun setOnboardingCompleted(completed: Boolean) {
        context.userPrefsDataStore.edit { prefs ->
            prefs[ONBOARDING_COMPLETED_KEY] = completed
        }
    }

    suspend fun setTutorialCompleted(completed: Boolean) {
        context.userPrefsDataStore.edit { prefs ->
            prefs[TUTORIAL_COMPLETED_KEY] = completed
        }
    }

    suspend fun setBiometricEnabled(enabled: Boolean) {
        context.userPrefsDataStore.edit { prefs ->
            prefs[BIOMETRIC_ENABLED_KEY] = enabled
        }
    }

    suspend fun isBiometricEnabled(): Boolean {
        return context.userPrefsDataStore.data.map { prefs ->
            prefs[BIOMETRIC_ENABLED_KEY] ?: false
        }.first()
    }

    suspend fun clearAll() {
        context.userPrefsDataStore.edit { prefs ->
            prefs.clear()
        }
    }
}
