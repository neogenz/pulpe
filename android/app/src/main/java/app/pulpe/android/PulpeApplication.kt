package app.pulpe.android

import android.app.Application
import app.pulpe.android.data.local.SecureTokenStorage
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltAndroidApp
class PulpeApplication : Application() {

    @Inject
    lateinit var secureTokenStorage: SecureTokenStorage

    private val applicationScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        applicationScope.launch(Dispatchers.IO) {
            secureTokenStorage.init()
        }
    }
}
