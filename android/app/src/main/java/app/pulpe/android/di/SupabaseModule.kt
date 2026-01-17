package app.pulpe.android.di

import app.pulpe.android.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.FlowType
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object SupabaseModule {

    @Provides
    @Singleton
    fun provideSupabaseClient(): SupabaseClient {
        val supabaseUrl = if (BuildConfig.DEBUG) {
            BuildConfig.SUPABASE_URL_DEBUG
        } else {
            BuildConfig.SUPABASE_URL_RELEASE
        }

        val supabaseKey = if (BuildConfig.DEBUG) {
            BuildConfig.SUPABASE_ANON_KEY_DEBUG
        } else {
            BuildConfig.SUPABASE_ANON_KEY_RELEASE
        }

        return createSupabaseClient(
            supabaseUrl = supabaseUrl,
            supabaseKey = supabaseKey
        ) {
            install(Auth) {
                flowType = FlowType.PKCE
                scheme = "pulpe"
                host = "auth"
            }
            install(Postgrest)
        }
    }
}
