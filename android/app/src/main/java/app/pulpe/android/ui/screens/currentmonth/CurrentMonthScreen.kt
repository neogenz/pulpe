package app.pulpe.android.ui.screens.currentmonth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pulpe.android.ui.components.EmptyStateView
import app.pulpe.android.ui.components.ErrorView
import app.pulpe.android.ui.components.HeroBalanceCard
import app.pulpe.android.ui.components.LoadingView
import app.pulpe.android.ui.components.QuickActionsBar
import app.pulpe.android.ui.components.TransactionListItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CurrentMonthScreen(
    onNavigateToAccount: () -> Unit,
    onNavigateToBudget: (String) -> Unit,
    viewModel: CurrentMonthViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollBehavior = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()

    LaunchedEffect(Unit) {
        viewModel.loadData()
    }

    Scaffold(
        modifier = Modifier.nestedScroll(scrollBehavior.nestedScrollConnection),
        topBar = {
            LargeTopAppBar(
                title = { Text("Ce mois-ci") },
                actions = {
                    IconButton(onClick = onNavigateToAccount) {
                        Icon(Icons.Default.AccountCircle, contentDescription = "Mon compte")
                    }
                },
                scrollBehavior = scrollBehavior,
                colors = TopAppBarDefaults.largeTopAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer
                )
            )
        },
        floatingActionButton = {
            if (uiState.budget != null) {
                FloatingActionButton(
                    onClick = { viewModel.showAddTransaction() }
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Ajouter une transaction")
                }
            }
        }
    ) { paddingValues ->
        when {
            uiState.isLoading && uiState.budget == null -> {
                LoadingView(
                    message = "Préparation de ton tableau de bord...",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.error != null && uiState.budget == null -> {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadData() },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.budget == null -> {
                EmptyStateView(
                    title = "Pas encore de budget ce mois-ci",
                    description = "Crée ton budget dans l'onglet Budgets pour commencer",
                    iconName = "calendar_add_on",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            else -> {
                PullToRefreshBox(
                    isRefreshing = uiState.isLoading,
                    onRefresh = { viewModel.loadData() },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Hero balance card
                        item {
                            HeroBalanceCard(
                                metrics = uiState.metrics,
                                daysRemaining = uiState.daysRemaining,
                                dailyBudget = uiState.dailyBudget,
                                onTapProgress = { viewModel.showRealizedBalance() }
                            )
                        }

                        // Quick actions bar
                        item {
                            QuickActionsBar(
                                onAddTransaction = { viewModel.showAddTransaction() },
                                onShowStats = { viewModel.showRealizedBalance() },
                                onShowBudget = {
                                    uiState.budget?.id?.let { onNavigateToBudget(it) }
                                }
                            )
                        }

                        // Alerts section
                        if (uiState.alertBudgetLines.isNotEmpty()) {
                            item {
                                Card(
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.errorContainer
                                    )
                                ) {
                                    Column(modifier = Modifier.padding(16.dp)) {
                                        Text(
                                            text = "Attention",
                                            style = MaterialTheme.typography.titleMedium,
                                            color = MaterialTheme.colorScheme.onErrorContainer
                                        )
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text(
                                            text = "${uiState.alertBudgetLines.size} catégorie(s) à plus de 80%",
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MaterialTheme.colorScheme.onErrorContainer
                                        )
                                        TextButton(
                                            onClick = {
                                                uiState.budget?.id?.let { onNavigateToBudget(it) }
                                            }
                                        ) {
                                            Text("Voir le budget")
                                        }
                                    }
                                }
                            }
                        }

                        // Recent transactions
                        if (uiState.recentTransactions.isNotEmpty()) {
                            item {
                                Text(
                                    text = "Transactions récentes",
                                    style = MaterialTheme.typography.titleMedium,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }

                            items(uiState.recentTransactions) { transaction ->
                                TransactionListItem(
                                    transaction = transaction,
                                    onClick = { /* TODO: Edit transaction */ }
                                )
                            }

                            if (uiState.recentTransactions.size >= 5) {
                                item {
                                    TextButton(
                                        onClick = {
                                            uiState.budget?.id?.let { onNavigateToBudget(it) }
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("Voir toutes les transactions")
                                    }
                                }
                            }
                        }

                        // Unchecked transactions
                        if (uiState.uncheckedTransactions.isNotEmpty()) {
                            item {
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "À pointer",
                                    style = MaterialTheme.typography.titleMedium,
                                    modifier = Modifier.padding(vertical = 8.dp)
                                )
                            }

                            items(uiState.uncheckedTransactions) { transaction ->
                                TransactionListItem(
                                    transaction = transaction,
                                    onClick = { /* TODO: Toggle check */ }
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    // Add Transaction Sheet
    if (uiState.showAddTransactionSheet) {
        AddTransactionSheet(
            budgetId = uiState.budget?.id ?: "",
            onDismiss = { viewModel.hideAddTransaction() },
            onTransactionAdded = { viewModel.onTransactionAdded(it) }
        )
    }

    // Realized Balance Sheet
    if (uiState.showRealizedBalanceSheet) {
        RealizedBalanceSheet(
            metrics = uiState.metrics,
            realizedMetrics = uiState.realizedMetrics,
            onDismiss = { viewModel.hideRealizedBalance() }
        )
    }
}
