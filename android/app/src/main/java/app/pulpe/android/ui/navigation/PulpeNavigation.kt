package app.pulpe.android.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Today
import androidx.compose.ui.graphics.vector.ImageVector

sealed class Screen(val route: String) {
    // Auth
    data object Login : Screen("login")
    data object Onboarding : Screen("onboarding")

    // Main tabs
    data object CurrentMonth : Screen("current_month")
    data object Budgets : Screen("budgets")
    data object Templates : Screen("templates")

    // Detail screens
    data object BudgetDetails : Screen("budget_details/{budgetId}") {
        fun createRoute(budgetId: String) = "budget_details/$budgetId"
    }

    data object TemplateDetails : Screen("template_details/{templateId}") {
        fun createRoute(templateId: String) = "template_details/$templateId"
    }

    // Account
    data object Account : Screen("account")

    // Forms
    data object AddTransaction : Screen("add_transaction/{budgetId}") {
        fun createRoute(budgetId: String) = "add_transaction/$budgetId"
    }

    data object EditTransaction : Screen("edit_transaction/{transactionId}") {
        fun createRoute(transactionId: String) = "edit_transaction/$transactionId"
    }

    data object AddBudgetLine : Screen("add_budget_line/{budgetId}") {
        fun createRoute(budgetId: String) = "add_budget_line/$budgetId"
    }

    data object EditBudgetLine : Screen("edit_budget_line/{budgetLineId}") {
        fun createRoute(budgetLineId: String) = "edit_budget_line/$budgetLineId"
    }

    data object CreateBudget : Screen("create_budget")
    data object CreateTemplate : Screen("create_template")
}

enum class BottomNavItem(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    CURRENT_MONTH(
        route = Screen.CurrentMonth.route,
        title = "Ce mois-ci",
        selectedIcon = Icons.Filled.Today,
        unselectedIcon = Icons.Outlined.Today
    ),
    BUDGETS(
        route = Screen.Budgets.route,
        title = "Budgets",
        selectedIcon = Icons.Filled.CalendarMonth,
        unselectedIcon = Icons.Outlined.CalendarMonth
    ),
    TEMPLATES(
        route = Screen.Templates.route,
        title = "Modèles",
        selectedIcon = Icons.Filled.Description,
        unselectedIcon = Icons.Outlined.Description
    )
}
