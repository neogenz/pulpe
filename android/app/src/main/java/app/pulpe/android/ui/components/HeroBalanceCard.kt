package app.pulpe.android.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import app.pulpe.android.domain.model.BudgetFormulas
import app.pulpe.android.ui.theme.PulpeTheme
import java.math.BigDecimal
import java.text.NumberFormat
import java.util.Locale

@Composable
fun HeroBalanceCard(
    metrics: BudgetFormulas.Metrics,
    daysRemaining: Int? = null,
    dailyBudget: BigDecimal? = null,
    onTapProgress: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isOverBudget = metrics.remaining < BigDecimal.ZERO
    val progressPercentage = if (metrics.available > BigDecimal.ZERO) {
        (metrics.totalExpenses.toDouble() / metrics.available.toDouble()).coerceIn(0.0, 1.0)
    } else 1.0

    val displayPercentage = (progressPercentage * 100).toInt()

    val progressColor = when {
        isOverBudget -> MaterialTheme.colorScheme.error
        progressPercentage > 0.85 -> Color(0xFFEF6C00) // Orange
        else -> MaterialTheme.colorScheme.primary
    }

    val balanceColor = if (isOverBudget) {
        MaterialTheme.colorScheme.error
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    OutlinedCard(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp)
        ) {
            // Main balance section
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Disponible CHF",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = formatCurrency(metrics.remaining),
                        style = MaterialTheme.typography.displaySmall.copy(
                            fontWeight = FontWeight.Bold
                        ),
                        color = balanceColor
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    if (isOverBudget) {
                        Text(
                            text = "Tu as dépassé ton budget — ça arrive",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.error
                        )
                    } else if (daysRemaining != null && dailyBudget != null && dailyBudget > BigDecimal.ZERO) {
                        Text(
                            text = "$daysRemaining jours restants · ~${formatCompactCurrency(dailyBudget)}/jour",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }

                // Circular progress indicator
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clickable(onClick = onTapProgress),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(
                        progressPercentage = progressPercentage.toFloat(),
                        color = progressColor,
                        modifier = Modifier.size(64.dp)
                    )

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "$displayPercentage",
                            style = MaterialTheme.typography.titleMedium.copy(
                                fontWeight = FontWeight.Bold
                            ),
                            color = progressColor
                        )
                        Text(
                            text = "%",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            HorizontalDivider()

            Spacer(modifier = Modifier.height(16.dp))

            // Stats row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                StatItem(
                    label = "Dépenses CHF",
                    value = metrics.totalExpenses,
                    color = PulpeTheme.colors.financialExpense
                )

                StatItem(
                    label = "Revenus CHF",
                    value = metrics.totalIncome,
                    color = PulpeTheme.colors.financialIncome
                )

                StatItem(
                    label = "Épargne CHF",
                    value = metrics.totalSavings,
                    color = PulpeTheme.colors.financialSavings
                )
            }
        }
    }
}

@Composable
private fun CircularProgressIndicator(
    progressPercentage: Float,
    color: Color,
    modifier: Modifier = Modifier
) {
    val animatedProgress by animateFloatAsState(
        targetValue = progressPercentage,
        animationSpec = spring(dampingRatio = 0.8f, stiffness = 100f),
        label = "progress"
    )

    val trackColor = MaterialTheme.colorScheme.surfaceVariant

    Canvas(modifier = modifier) {
        val strokeWidth = 6.dp.toPx()
        val diameter = size.minDimension - strokeWidth

        // Track
        drawArc(
            color = trackColor,
            startAngle = 0f,
            sweepAngle = 360f,
            useCenter = false,
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
            size = androidx.compose.ui.geometry.Size(diameter, diameter),
            topLeft = androidx.compose.ui.geometry.Offset(strokeWidth / 2, strokeWidth / 2)
        )

        // Progress
        drawArc(
            color = color,
            startAngle = -90f,
            sweepAngle = animatedProgress * 360f,
            useCenter = false,
            style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
            size = androidx.compose.ui.geometry.Size(diameter, diameter),
            topLeft = androidx.compose.ui.geometry.Offset(strokeWidth / 2, strokeWidth / 2)
        )
    }
}

@Composable
private fun StatItem(
    label: String,
    value: BigDecimal,
    color: Color
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = formatCompactCurrency(value),
            style = MaterialTheme.typography.titleSmall.copy(
                fontWeight = FontWeight.SemiBold
            ),
            color = color
        )
    }
}

private fun formatCurrency(value: BigDecimal): String {
    val formatter = NumberFormat.getNumberInstance(Locale("fr", "CH"))
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 2
    return formatter.format(value)
}

private fun formatCompactCurrency(value: BigDecimal): String {
    val formatter = NumberFormat.getNumberInstance(Locale("fr", "CH"))
    formatter.minimumFractionDigits = 0
    formatter.maximumFractionDigits = 0
    return "CHF ${formatter.format(value)}"
}
