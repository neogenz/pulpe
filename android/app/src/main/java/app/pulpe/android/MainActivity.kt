package app.pulpe.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.compose.rememberNavController
import app.pulpe.android.data.local.UserPreferences
import app.pulpe.android.data.repository.AuthRepository
import app.pulpe.android.ui.navigation.PulpeNavHost
import app.pulpe.android.ui.navigation.Screen
import app.pulpe.android.ui.theme.PulpeTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var userPreferences: UserPreferences

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            PulpeTheme {
                var isLoading by remember { mutableStateOf(true) }
                var startDestination by remember { mutableStateOf(Screen.Login.route) }

                LaunchedEffect(Unit) {
                    withContext(Dispatchers.IO) {
                        val isAuthenticated = authRepository.isAuthenticated()
                        val hasCompletedOnboarding = authRepository.hasCompletedOnboarding()

                        startDestination = when {
                            isAuthenticated -> Screen.CurrentMonth.route
                            else -> Screen.Login.route
                        }
                        isLoading = false
                    }
                }

                Surface(modifier = Modifier.fillMaxSize()) {
                    if (isLoading) {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator()
                        }
                    } else {
                        val navController = rememberNavController()
                        PulpeNavHost(
                            navController = navController,
                            startDestination = startDestination,
                            onLogout = {
                                // Logout handled in AccountScreen
                            }
                        )
                    }
                }
            }
        }
    }
}
