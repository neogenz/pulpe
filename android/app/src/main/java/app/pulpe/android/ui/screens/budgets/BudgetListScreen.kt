package app.pulpe.android.ui.screens.budgets

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pulpe.android.domain.model.Budget
import app.pulpe.android.ui.components.EmptyStateView
import app.pulpe.android.ui.components.ErrorView
import app.pulpe.android.ui.components.LoadingView
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetListScreen(
    onNavigateToBudget: (String) -> Unit,
    onNavigateToCreateBudget: () -> Unit,
    viewModel: BudgetListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadBudgets()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Budgets") }
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreateBudget) {
                Icon(Icons.Default.Add, contentDescription = "Créer un budget")
            }
        }
    ) { paddingValues ->
        when {
            uiState.isLoading && uiState.budgets.isEmpty() -> {
                LoadingView(
                    message = "Chargement des budgets...",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.error != null && uiState.budgets.isEmpty() -> {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadBudgets() },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.budgets.isEmpty() -> {
                EmptyStateView(
                    title = "Aucun budget trouvé",
                    description = "Crée ton premier budget pour commencer",
                    iconName = "calendar_add_on",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            else -> {
                PullToRefreshBox(
                    isRefreshing = uiState.isLoading,
                    onRefresh = { viewModel.loadBudgets() },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.budgets) { budget ->
                            BudgetListItem(
                                budget = budget,
                                onClick = { onNavigateToBudget(budget.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun BudgetListItem(
    budget: Budget,
    onClick: () -> Unit
) {
    val formatter = NumberFormat.getCurrencyInstance(Locale("fr", "CH")).apply {
        currency = java.util.Currency.getInstance("CHF")
    }

    val remaining = budget.remaining ?: 0.0
    val isNegative = remaining < 0

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                shape = MaterialTheme.shapes.medium,
                modifier = Modifier.size(48.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.CalendarMonth,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = budget.monthYear,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                if (budget.description.isNotBlank()) {
                    Text(
                        text = budget.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Remaining
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatter.format(remaining),
                    style = MaterialTheme.typography.titleMedium,
                    color = if (isNegative) {
                        MaterialTheme.colorScheme.error
                    } else {
                        MaterialTheme.colorScheme.primary
                    },
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "Restant",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Current month badge
            if (budget.isCurrentMonth) {
                Spacer(modifier = Modifier.width(8.dp))
                Badge(
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Text("Actuel")
                }
            }
        }
    }
}
