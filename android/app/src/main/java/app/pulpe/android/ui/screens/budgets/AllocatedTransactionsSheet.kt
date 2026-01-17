package app.pulpe.android.ui.screens.budgets

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.pulpe.android.domain.model.BudgetFormulas
import app.pulpe.android.domain.model.BudgetLine
import app.pulpe.android.domain.model.Transaction
import app.pulpe.android.domain.model.TransactionKind
import app.pulpe.android.ui.theme.PulpeTheme
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllocatedTransactionsSheet(
    budgetLine: BudgetLine,
    consumption: BudgetFormulas.Consumption,
    transactions: List<Transaction>,
    onDismiss: () -> Unit,
    onToggleCheck: (Transaction) -> Unit,
    onEditTransaction: (Transaction) -> Unit,
    onDeleteTransaction: (Transaction) -> Unit,
    onAddTransaction: () -> Unit
) {
    val formatter = NumberFormat.getCurrencyInstance(Locale("fr", "CH")).apply {
        currency = java.util.Currency.getInstance("CHF")
    }

    val color = when (budgetLine.kind) {
        TransactionKind.INCOME -> PulpeTheme.colors.financialIncome
        TransactionKind.EXPENSE -> PulpeTheme.colors.financialExpense
        TransactionKind.SAVING -> PulpeTheme.colors.financialSavings
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
        ) {
            // Header
            Text(
                text = budgetLine.name,
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Summary row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column {
                    Text(
                        text = "Prévu",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatter.format(budgetLine.amount),
                        style = MaterialTheme.typography.bodyMedium
                    )
                }
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = "Consommé",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatter.format(consumption.allocated),
                        style = MaterialTheme.typography.bodyMedium,
                        color = color
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Text(
                        text = "Disponible",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = formatter.format(consumption.available),
                        style = MaterialTheme.typography.bodyMedium,
                        color = if (consumption.available < java.math.BigDecimal.ZERO) {
                            MaterialTheme.colorScheme.error
                        } else {
                            MaterialTheme.colorScheme.onSurface
                        }
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Progress bar
            val progressColor = when {
                consumption.isOverBudget -> MaterialTheme.colorScheme.error
                consumption.isNearLimit -> MaterialTheme.colorScheme.tertiary
                else -> MaterialTheme.colorScheme.primary
            }

            LinearProgressIndicator(
                progress = { (consumption.percentage / 100).coerceIn(0.0, 1.0).toFloat() },
                modifier = Modifier.fillMaxWidth(),
                color = progressColor
            )

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.End
            ) {
                Text(
                    text = "${consumption.percentage.toInt()}%",
                    style = MaterialTheme.typography.labelSmall,
                    color = progressColor
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            HorizontalDivider()

            Spacer(modifier = Modifier.height(16.dp))

            // Transactions list
            if (transactions.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Aucune transaction",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 300.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(transactions, key = { it.id }) { transaction ->
                        AllocatedTransactionItem(
                            transaction = transaction,
                            onToggleCheck = { onToggleCheck(transaction) },
                            onClick = { onEditTransaction(transaction) },
                            onDelete = { onDeleteTransaction(transaction) }
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Actions
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                OutlinedButton(
                    onClick = onDismiss,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Fermer")
                }
                Button(
                    onClick = onAddTransaction,
                    modifier = Modifier.weight(1f)
                ) {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Nouvelle transaction")
                }
            }
        }
    }
}

@Composable
private fun AllocatedTransactionItem(
    transaction: Transaction,
    onToggleCheck: () -> Unit,
    onClick: () -> Unit,
    onDelete: () -> Unit
) {
    val formatter = NumberFormat.getCurrencyInstance(Locale("fr", "CH")).apply {
        currency = java.util.Currency.getInstance("CHF")
    }
    val dateFormatter = DateTimeFormatter.ofPattern("d MMM", Locale.FRENCH)

    val color = when (transaction.kind) {
        TransactionKind.INCOME -> PulpeTheme.colors.financialIncome
        TransactionKind.EXPENSE -> PulpeTheme.colors.financialExpense
        TransactionKind.SAVING -> PulpeTheme.colors.financialSavings
    }

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(horizontal = 12.dp, vertical = 8.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Toggle check button
            IconButton(
                onClick = onToggleCheck,
                modifier = Modifier.size(40.dp)
            ) {
                Icon(
                    imageVector = if (transaction.isChecked) {
                        Icons.Default.CheckCircle
                    } else {
                        Icons.Default.RadioButtonUnchecked
                    },
                    contentDescription = if (transaction.isChecked) "Pointé" else "Non pointé",
                    tint = if (transaction.isChecked) {
                        MaterialTheme.colorScheme.primary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    }
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            // Name and date
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = transaction.name,
                    style = MaterialTheme.typography.bodyMedium
                )
                Text(
                    text = try {
                        val instant = Instant.parse(transaction.transactionDate)
                        instant.atZone(ZoneId.systemDefault()).format(dateFormatter)
                    } catch (e: Exception) {
                        transaction.transactionDate
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Amount
            Text(
                text = formatter.format(transaction.amount),
                style = MaterialTheme.typography.bodyMedium,
                color = color
            )

            Spacer(modifier = Modifier.width(8.dp))

            // Delete button
            IconButton(
                onClick = onDelete,
                modifier = Modifier.size(32.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Delete,
                    contentDescription = "Supprimer",
                    tint = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}
