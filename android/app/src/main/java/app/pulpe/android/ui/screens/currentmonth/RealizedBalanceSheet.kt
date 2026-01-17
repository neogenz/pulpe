package app.pulpe.android.ui.screens.currentmonth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pulpe.android.domain.model.BudgetFormulas
import app.pulpe.android.ui.theme.PulpeTheme
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RealizedBalanceSheet(
    metrics: BudgetFormulas.Metrics,
    realizedMetrics: BudgetFormulas.RealizedMetrics,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
        ) {
            Text(
                text = "Bilan du mois",
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Planned section
            Text(
                text = "Prévu",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            BalanceRow(
                label = "Revenus totaux",
                value = metrics.totalIncome,
                color = PulpeTheme.colors.financialIncome
            )
            BalanceRow(
                label = "Dépenses totales",
                value = metrics.totalExpenses,
                color = PulpeTheme.colors.financialExpense
            )
            BalanceRow(
                label = "Épargne prévue",
                value = metrics.totalSavings,
                color = PulpeTheme.colors.financialSavings
            )

            if (metrics.rollover != BigDecimal.ZERO) {
                BalanceRow(
                    label = "Report du mois précédent",
                    value = metrics.rollover,
                    color = MaterialTheme.colorScheme.tertiary
                )
            }

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

            BalanceRow(
                label = "Disponible",
                value = metrics.remaining,
                color = if (metrics.remaining >= BigDecimal.ZERO) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.error
                },
                isBold = true
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Realized section
            Text(
                text = "Réalisé (pointé)",
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(12.dp))

            BalanceRow(
                label = "Revenus pointés",
                value = realizedMetrics.realizedIncome,
                color = PulpeTheme.colors.financialIncome
            )
            BalanceRow(
                label = "Dépenses pointées",
                value = realizedMetrics.realizedExpenses,
                color = PulpeTheme.colors.financialExpense
            )

            HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))

            BalanceRow(
                label = "Solde réel",
                value = realizedMetrics.realizedBalance,
                color = if (realizedMetrics.realizedBalance >= BigDecimal.ZERO) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.error
                },
                isBold = true
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Progress indicator
            LinearProgressIndicator(
                progress = { realizedMetrics.completionPercentage.toFloat() / 100f },
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "${realizedMetrics.checkedItemsCount}/${realizedMetrics.totalItemsCount} éléments pointés (${realizedMetrics.completionPercentage.toInt()}%)",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

@Composable
private fun BalanceRow(
    label: String,
    value: BigDecimal,
    color: androidx.compose.ui.graphics.Color,
    isBold: Boolean = false
) {
    val formatter = NumberFormat.getCurrencyInstance(Locale("fr", "CH")).apply {
        currency = java.util.Currency.getInstance("CHF")
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            style = if (isBold) {
                MaterialTheme.typography.bodyLarge.copy(fontWeight = FontWeight.SemiBold)
            } else {
                MaterialTheme.typography.bodyMedium
            }
        )
        Text(
            text = formatter.format(value),
            style = if (isBold) {
                MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold)
            } else {
                MaterialTheme.typography.bodyLarge
            },
            color = color
        )
    }
}
