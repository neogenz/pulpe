package app.pulpe.android.ui.components

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

@Composable
fun ConfirmationDialog(
    title: String,
    message: String,
    confirmText: String = "Confirmer",
    cancelText: String = "Annuler",
    isLoading: Boolean = false,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    modifier: Modifier = Modifier
) {
    AlertDialog(
        onDismissRequest = { if (!isLoading) onDismiss() },
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            Button(
                onClick = onConfirm,
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.error
                )
            ) {
                if (isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier,
                        color = MaterialTheme.colorScheme.onError
                    )
                } else {
                    Text(confirmText)
                }
            }
        },
        dismissButton = {
            TextButton(
                onClick = onDismiss,
                enabled = !isLoading
            ) {
                Text(cancelText)
            }
        },
        modifier = modifier
    )
}
