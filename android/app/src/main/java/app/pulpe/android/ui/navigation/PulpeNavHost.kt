package app.pulpe.android.ui.navigation

import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import app.pulpe.android.ui.screens.account.AccountScreen
import app.pulpe.android.ui.screens.auth.LoginScreen
import app.pulpe.android.ui.screens.budgets.BudgetDetailsScreen
import app.pulpe.android.ui.screens.budgets.BudgetListScreen
import app.pulpe.android.ui.screens.budgets.CreateBudgetScreen
import app.pulpe.android.ui.screens.currentmonth.CurrentMonthScreen
import app.pulpe.android.ui.screens.onboarding.OnboardingScreen
import app.pulpe.android.ui.screens.templates.CreateTemplateScreen
import app.pulpe.android.ui.screens.templates.TemplateDetailsScreen
import app.pulpe.android.ui.screens.templates.TemplateListScreen

@Composable
fun PulpeNavHost(
    navController: NavHostController = rememberNavController(),
    startDestination: String,
    onLogout: () -> Unit
) {
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = navBackStackEntry?.destination

    val bottomNavItems = listOf(
        BottomNavItem.CURRENT_MONTH,
        BottomNavItem.BUDGETS,
        BottomNavItem.TEMPLATES
    )

    val showBottomBar = bottomNavItems.any { item ->
        currentDestination?.hierarchy?.any { it.route == item.route } == true
    }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { item ->
                        val isSelected = currentDestination?.hierarchy?.any {
                            it.route == item.route
                        } == true

                        NavigationBarItem(
                            icon = {
                                Icon(
                                    imageVector = if (isSelected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.title
                                )
                            },
                            label = { Text(item.title) },
                            selected = isSelected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier
                .padding(innerPadding)
                .consumeWindowInsets(innerPadding)
        ) {
            // Auth
            composable(Screen.Login.route) {
                LoginScreen(
                    onLoginSuccess = {
                        navController.navigate(Screen.CurrentMonth.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    },
                    onNavigateToOnboarding = {
                        navController.navigate(Screen.Onboarding.route) {
                            popUpTo(Screen.Login.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.Onboarding.route) {
                OnboardingScreen(
                    onOnboardingComplete = {
                        navController.navigate(Screen.CurrentMonth.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    },
                    onNavigateToLogin = {
                        navController.navigate(Screen.Login.route) {
                            popUpTo(Screen.Onboarding.route) { inclusive = true }
                        }
                    }
                )
            }

            // Main tabs
            composable(Screen.CurrentMonth.route) {
                CurrentMonthScreen(
                    onNavigateToAccount = {
                        navController.navigate(Screen.Account.route)
                    },
                    onNavigateToBudget = { budgetId ->
                        navController.navigate(Screen.BudgetDetails.createRoute(budgetId))
                    }
                )
            }

            composable(Screen.Budgets.route) {
                BudgetListScreen(
                    onNavigateToBudget = { budgetId ->
                        navController.navigate(Screen.BudgetDetails.createRoute(budgetId))
                    },
                    onNavigateToCreateBudget = {
                        navController.navigate(Screen.CreateBudget.route)
                    }
                )
            }

            composable(Screen.Templates.route) {
                TemplateListScreen(
                    onNavigateToTemplate = { templateId ->
                        navController.navigate(Screen.TemplateDetails.createRoute(templateId))
                    },
                    onNavigateToCreateTemplate = {
                        navController.navigate(Screen.CreateTemplate.route)
                    }
                )
            }

            // Detail screens
            composable(
                route = Screen.BudgetDetails.route,
                arguments = listOf(navArgument("budgetId") { type = NavType.StringType })
            ) { backStackEntry ->
                val budgetId = backStackEntry.arguments?.getString("budgetId") ?: return@composable
                BudgetDetailsScreen(
                    budgetId = budgetId,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            composable(
                route = Screen.TemplateDetails.route,
                arguments = listOf(navArgument("templateId") { type = NavType.StringType })
            ) { backStackEntry ->
                val templateId = backStackEntry.arguments?.getString("templateId") ?: return@composable
                TemplateDetailsScreen(
                    templateId = templateId,
                    onNavigateBack = { navController.popBackStack() }
                )
            }

            // Create screens
            composable(Screen.CreateBudget.route) {
                CreateBudgetScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onBudgetCreated = { budgetId ->
                        navController.navigate(Screen.BudgetDetails.createRoute(budgetId)) {
                            popUpTo(Screen.CreateBudget.route) { inclusive = true }
                        }
                    }
                )
            }

            composable(Screen.CreateTemplate.route) {
                CreateTemplateScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onTemplateCreated = { templateId ->
                        navController.navigate(Screen.TemplateDetails.createRoute(templateId)) {
                            popUpTo(Screen.CreateTemplate.route) { inclusive = true }
                        }
                    }
                )
            }

            // Account
            composable(Screen.Account.route) {
                AccountScreen(
                    onNavigateBack = { navController.popBackStack() },
                    onLogout = {
                        onLogout()
                        navController.navigate(Screen.Login.route) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                )
            }
        }
    }
}
