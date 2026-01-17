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
import app.pulpe.android.ui.screens.currentmonth.AddTransactionSheet
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
    var selectedBudgetLineForTransaction by remember { mutableStateOf<BudgetLine?>(null) }

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

                            items(uiState.recurringBudgetLines, key = { it.id }) { line ->
                                SwipeableItemContainer(
                                    onEdit = if (!line.isVirtualRollover) {{ viewModel.showEditBudgetLine(line) }} else null,
                                    onDelete = if (!line.isVirtualRollover) {{ viewModel.showDeleteBudgetLineConfirmation(line) }} else null
                                ) {
                                    BudgetLineItem(
                                        budgetLine = line,
                                        consumption = uiState.getConsumption(line),
                                        onClick = { viewModel.showBudgetLineDetails(line) },
                                        onAddTransaction = { selectedBudgetLineForTransaction = line },
                                        onToggleCheck = if (!line.isVirtualRollover) {{ viewModel.toggleBudgetLineCheck(line) }} else null
                                    )
                                }
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

                            items(uiState.oneOffBudgetLines, key = { it.id }) { line ->
                                SwipeableItemContainer(
                                    onEdit = if (!line.isVirtualRollover) {{ viewModel.showEditBudgetLine(line) }} else null,
                                    onDelete = if (!line.isVirtualRollover) {{ viewModel.showDeleteBudgetLineConfirmation(line) }} else null
                                ) {
                                    BudgetLineItem(
                                        budgetLine = line,
                                        consumption = uiState.getConsumption(line),
                                        onClick = { viewModel.showBudgetLineDetails(line) },
                                        onAddTransaction = { selectedBudgetLineForTransaction = line },
                                        onToggleCheck = if (!line.isVirtualRollover) {{ viewModel.toggleBudgetLineCheck(line) }} else null
                                    )
                                }
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

                            items(uiState.transactions, key = { it.id }) { transaction ->
                                SwipeableItemContainer(
                                    onEdit = { viewModel.showEditTransaction(transaction) },
                                    onDelete = { viewModel.showDeleteConfirmation(transaction) }
                                ) {
                                    TransactionListItem(
                                        transaction = transaction,
                                        onClick = { viewModel.showEditTransaction(transaction) },
                                        onToggleCheck = { viewModel.toggleTransactionCheck(transaction) }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Free transaction sheet (from FAB)
    if (uiState.showAddTransactionSheet) {
        AddTransactionSheet(
            budgetId = budgetId,
            onDismiss = { viewModel.hideAddTransaction() },
            onTransactionAdded = { transaction ->
                viewModel.onTransactionAdded(transaction)
            }
        )
    }

    // Allocated transaction sheet (from budget line "+" button)
    selectedBudgetLineForTransaction?.let { budgetLine ->
        AddAllocatedTransactionSheet(
            budgetLine = budgetLine,
            onDismiss = { selectedBudgetLineForTransaction = null },
            onTransactionAdded = { transaction ->
                viewModel.onTransactionAdded(transaction)
                selectedBudgetLineForTransaction = null
            }
        )
    }

    // Budget line details sheet (showing allocated transactions)
    uiState.selectedBudgetLineForDetails?.let { budgetLine ->
        AllocatedTransactionsSheet(
            budgetLine = budgetLine,
            consumption = uiState.getConsumption(budgetLine),
            transactions = uiState.getAllocatedTransactions(budgetLine.id),
            onDismiss = { viewModel.hideBudgetLineDetails() },
            onToggleCheck = { transaction -> viewModel.toggleTransactionCheck(transaction) },
            onEditTransaction = { transaction ->
                viewModel.hideBudgetLineDetails()
                viewModel.showEditTransaction(transaction)
            },
            onDeleteTransaction = { transaction -> viewModel.showDeleteConfirmation(transaction) },
            onAddTransaction = {
                viewModel.hideBudgetLineDetails()
                selectedBudgetLineForTransaction = budgetLine
            }
        )
    }

    // Edit transaction sheet
    uiState.selectedTransactionForEdit?.let { transaction ->
        EditTransactionSheet(
            transaction = transaction,
            isLoading = uiState.isTransactionOperationLoading,
            error = uiState.transactionOperationError,
            onDismiss = { viewModel.hideEditTransaction() },
            onSave = { update -> viewModel.updateTransaction(transaction.id, update) },
            onClearError = { viewModel.clearTransactionOperationError() }
        )
    }

    // Delete transaction confirmation dialog
    uiState.transactionToDelete?.let { transaction ->
        ConfirmationDialog(
            title = "Supprimer la transaction",
            message = "Voulez-vous vraiment supprimer \"${transaction.name}\" ?",
            confirmText = "Supprimer",
            cancelText = "Annuler",
            isLoading = uiState.isTransactionOperationLoading,
            onConfirm = { viewModel.confirmDeleteTransaction() },
            onDismiss = { viewModel.hideDeleteConfirmation() }
        )
    }

    // Edit budget line sheet
    uiState.selectedBudgetLineForEdit?.let { budgetLine ->
        EditBudgetLineSheet(
            budgetLine = budgetLine,
            isLoading = uiState.isBudgetLineOperationLoading,
            error = uiState.budgetLineOperationError,
            onDismiss = { viewModel.hideEditBudgetLine() },
            onSave = { update -> viewModel.updateBudgetLine(update) },
            onClearError = { viewModel.clearBudgetLineOperationError() }
        )
    }

    // Delete budget line confirmation dialog
    uiState.budgetLineToDelete?.let { budgetLine ->
        ConfirmationDialog(
            title = "Supprimer la prévision",
            message = "Voulez-vous vraiment supprimer \"${budgetLine.name}\" ? Les transactions associées seront également supprimées.",
            confirmText = "Supprimer",
            cancelText = "Annuler",
            isLoading = uiState.isBudgetLineOperationLoading,
            onConfirm = { viewModel.confirmDeleteBudgetLine() },
            onDismiss = { viewModel.hideDeleteBudgetLineConfirmation() }
        )
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
    onClick: () -> Unit,
    onAddTransaction: () -> Unit,
    onToggleCheck: (() -> Unit)? = null
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
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 12.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Toggle check button
                if (onToggleCheck != null && !budgetLine.isVirtualRollover) {
                    IconButton(
                        onClick = onToggleCheck,
                        modifier = Modifier.size(40.dp)
                    ) {
                        Icon(
                            imageVector = if (budgetLine.isChecked) {
                                Icons.Default.CheckCircle
                            } else {
                                Icons.Default.RadioButtonUnchecked
                            },
                            contentDescription = if (budgetLine.isChecked) "Pointé" else "Non pointé",
                            tint = if (budgetLine.isChecked) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            }
                        )
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                }

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

                // Add transaction button (only for non-rollover lines)
                if (!budgetLine.isVirtualRollover) {
                    IconButton(
                        onClick = onAddTransaction,
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Add,
                            contentDescription = "Ajouter une transaction",
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                // Amount
                Text(
                    text = formatter.format(budgetLine.amount),
                    style = MaterialTheme.typography.titleMedium,
                    color = color
                )

                // Check indicator (only show if no toggle button)
                if (onToggleCheck == null && budgetLine.isChecked) {
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
