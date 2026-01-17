package app.pulpe.android.ui.screens.budgets

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import app.pulpe.android.domain.model.BudgetLine
import app.pulpe.android.domain.model.BudgetLineUpdate
import app.pulpe.android.domain.model.TransactionKind

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditBudgetLineSheet(
    budgetLine: BudgetLine,
    isLoading: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onSave: (BudgetLineUpdate) -> Unit,
    onClearError: () -> Unit
) {
    var name by remember { mutableStateOf(budgetLine.name) }
    var amountText by remember { mutableStateOf(budgetLine.amount.toString()) }
    var selectedKind by remember { mutableStateOf(budgetLine.kind) }

    val canSave = name.isNotBlank() && amountText.toDoubleOrNull() != null && amountText.toDoubleOrNull()!! > 0

    ModalBottomSheet(
        onDismissRequest = { if (!isLoading) onDismiss() }
    ) {
        Column(
            modifier = Modifier
                .padding(horizontal = 24.dp)
                .padding(bottom = 32.dp)
        ) {
            Text(
                text = "Modifier la prévision",
                style = MaterialTheme.typography.titleLarge
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = budgetLine.recurrence.label,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Name field
            OutlinedTextField(
                value = name,
                onValueChange = {
                    name = it
                    onClearError()
                },
                label = { Text("Nom") },
                singleLine = true,
                enabled = !isLoading,
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Amount field
            OutlinedTextField(
                value = amountText,
                onValueChange = {
                    amountText = it
                    onClearError()
                },
                label = { Text("Montant (CHF)") },
                singleLine = true,
                enabled = !isLoading,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Kind selector
            Text(
                text = "Type",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            SingleChoiceSegmentedButtonRow(
                modifier = Modifier.fillMaxWidth()
            ) {
                TransactionKind.entries.forEachIndexed { index, kind ->
                    SegmentedButton(
                        selected = selectedKind == kind,
                        onClick = {
                            selectedKind = kind
                            onClearError()
                        },
                        shape = SegmentedButtonDefaults.itemShape(
                            index = index,
                            count = TransactionKind.entries.size
                        ),
                        enabled = !isLoading
                    ) {
                        Text(kind.label)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Error message
            if (error != null) {
                Text(
                    text = error,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Save button
            Button(
                onClick = {
                    val amount = amountText.toDoubleOrNull()
                    if (amount != null) {
                        val update = BudgetLineUpdate(
                            id = budgetLine.id,
                            name = if (name != budgetLine.name) name else null,
                            amount = if (amount != budgetLine.amount) amount else null,
                            kind = if (selectedKind != budgetLine.kind) selectedKind else null,
                            isManuallyAdjusted = true
                        )
                        onSave(update)
                    }
                },
                enabled = canSave && !isLoading,
                modifier = Modifier.fillMaxWidth()
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(24.dp),
                        color = MaterialTheme.colorScheme.onPrimary
                    )
                } else {
                    Text("Enregistrer")
                }
            }
        }
    }
}
