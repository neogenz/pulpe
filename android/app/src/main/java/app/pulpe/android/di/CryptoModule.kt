package app.pulpe.android.di

import android.content.Context
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object CryptoModule {

    private const val KEYSET_NAME = "pulpe_token_keyset"
    private const val PREF_FILE_NAME = "pulpe_token_keyset_prefs"
    private const val MASTER_KEY_URI = "android-keystore://pulpe_master_key"

    init {
        AeadConfig.register()
    }

    @Provides
    @Singleton
    fun provideAead(@ApplicationContext context: Context): Aead {
        return AndroidKeysetManager.Builder()
            .withSharedPref(context, KEYSET_NAME, PREF_FILE_NAME)
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri(MASTER_KEY_URI)
            .build()
            .keysetHandle
            .getPrimitive(Aead::class.java)
    }
}
