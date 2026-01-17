package app.pulpe.android.ui.screens.budgets

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pulpe.android.domain.model.BudgetLine
import app.pulpe.android.domain.model.Transaction
import app.pulpe.android.domain.model.TransactionKind
import app.pulpe.android.domain.model.TransactionRecurrence
import app.pulpe.android.ui.components.*
import app.pulpe.android.ui.theme.PulpeTheme
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BudgetDetailsScreen(
    budgetId: String,
    onNavigateBack: () -> Unit,
    viewModel: BudgetDetailsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(budgetId) {
        viewModel.loadBudget(budgetId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.budget?.monthYear ?: "Budget") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                }
            )
        },
        floatingActionButton = {
            if (uiState.budget != null) {
                FloatingActionButton(
                    onClick = { viewModel.showAddTransaction() }
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Ajouter")
                }
            }
        }
    ) { paddingValues ->
        when {
            uiState.isLoading && uiState.budget == null -> {
                LoadingView(
                    message = "Chargement du budget...",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.error != null && uiState.budget == null -> {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadBudget(budgetId) },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.budget != null -> {
                PullToRefreshBox(
                    isRefreshing = uiState.isLoading,
                    onRefresh = { viewModel.loadBudget(budgetId) },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Metrics card
                        item {
                            HeroBalanceCard(
                                metrics = uiState.metrics,
                                onTapProgress = {}
                            )
                        }

                        // Recurring expenses section
                        if (uiState.recurringBudgetLines.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Récurrents",
                                    count = uiState.recurringBudgetLines.size
                                )
                            }

                            items(uiState.recurringBudgetLines) { line ->
                                BudgetLineItem(
                                    budgetLine = line,
                                    consumption = uiState.getConsumption(line),
                                    onClick = { /* TODO: Edit */ }
                                )
                            }
                        }

                        // One-off expenses section
                        if (uiState.oneOffBudgetLines.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Prévus",
                                    count = uiState.oneOffBudgetLines.size
                                )
                            }

                            items(uiState.oneOffBudgetLines) { line ->
                                BudgetLineItem(
                                    budgetLine = line,
                                    consumption = uiState.getConsumption(line),
                                    onClick = { /* TODO: Edit */ }
                                )
                            }
                        }

                        // Transactions section
                        if (uiState.transactions.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Transactions",
                                    count = uiState.transactions.size
                                )
                            }

                            items(uiState.transactions) { transaction ->
                                TransactionListItem(
                                    transaction = transaction,
                                    onClick = { /* TODO: Edit */ }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(
    title: String,
    count: Int
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Badge(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        ) {
            Text("$count")
        }
    }
}

@Composable
private fun BudgetLineItem(
    budgetLine: BudgetLine,
    consumption: app.pulpe.android.domain.model.BudgetFormulas.Consumption?,
    onClick: () -> Unit
) {
    val formatter = NumberFormat.getCurrencyInstance(Locale("fr", "CH")).apply {
        currency = java.util.Currency.getInstance("CHF")
    }

    val color = when (budgetLine.kind) {
        TransactionKind.INCOME -> PulpeTheme.colors.financialIncome
        TransactionKind.EXPENSE -> PulpeTheme.colors.financialExpense
        TransactionKind.SAVING -> PulpeTheme.colors.financialSavings
    }

    val icon = when (budgetLine.kind) {
        TransactionKind.INCOME -> Icons.Default.ArrowDownward
        TransactionKind.EXPENSE -> Icons.Default.ArrowUpward
        TransactionKind.SAVING -> Icons.Default.Savings
    }

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Icon
                Surface(
                    color = color.copy(alpha = 0.12f),
                    shape = MaterialTheme.shapes.medium,
                    modifier = Modifier.size(40.dp)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = color,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Name and recurrence
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = budgetLine.name,
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (budgetLine.recurrence == TransactionRecurrence.FIXED) {
                                Icons.Default.Repeat
                            } else {
                                Icons.Default.LooksOne
                            },
                            contentDescription = null,
                            modifier = Modifier.size(14.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = budgetLine.recurrence.label,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Amount
                Text(
                    text = formatter.format(budgetLine.amount),
                    style = MaterialTheme.typography.titleMedium,
                    color = color
                )

                // Check indicator
                if (budgetLine.isChecked) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Pointé",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // Consumption progress (for outflow budget lines)
            if (consumption != null && budgetLine.kind.isOutflow) {
                Spacer(modifier = Modifier.height(12.dp))

                val progressColor = when {
                    consumption.isOverBudget -> MaterialTheme.colorScheme.error
                    consumption.isNearLimit -> MaterialTheme.colorScheme.tertiary
                    else -> MaterialTheme.colorScheme.primary
                }

                LinearProgressIndicator(
                    progress = { (consumption.percentage / 100).coerceIn(0.0, 1.0).toFloat() },
                    modifier = Modifier.fillMaxWidth(),
                    color = progressColor,
                )

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Utilisé: ${formatter.format(consumption.allocated)}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "${consumption.percentage.toInt()}%",
                        style = MaterialTheme.typography.labelSmall,
                        color = progressColor
                    )
                }
            }
        }
    }
}
