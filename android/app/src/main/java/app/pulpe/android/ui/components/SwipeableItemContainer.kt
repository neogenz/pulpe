package app.pulpe.android.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SwipeableItemContainer(
    onDelete: (() -> Unit)? = null,
    onEdit: (() -> Unit)? = null,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { dismissValue ->
            when (dismissValue) {
                SwipeToDismissBoxValue.EndToStart -> {
                    onDelete?.invoke()
                    false // Don't auto-dismiss, let the callback handle it
                }
                SwipeToDismissBoxValue.StartToEnd -> {
                    onEdit?.invoke()
                    false // Don't auto-dismiss, let the callback handle it
                }
                SwipeToDismissBoxValue.Settled -> true
            }
        },
        positionalThreshold = { it * 0.4f }
    )

    SwipeToDismissBox(
        state = dismissState,
        backgroundContent = {
            val direction = dismissState.dismissDirection

            val backgroundColor by animateColorAsState(
                targetValue = when (direction) {
                    SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.errorContainer
                    SwipeToDismissBoxValue.StartToEnd -> MaterialTheme.colorScheme.primaryContainer
                    else -> Color.Transparent
                },
                label = "background"
            )

            val iconColor = when (direction) {
                SwipeToDismissBoxValue.EndToStart -> MaterialTheme.colorScheme.onErrorContainer
                SwipeToDismissBoxValue.StartToEnd -> MaterialTheme.colorScheme.onPrimaryContainer
                else -> Color.Transparent
            }

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(backgroundColor)
                    .padding(horizontal = 20.dp),
                contentAlignment = when (direction) {
                    SwipeToDismissBoxValue.EndToStart -> Alignment.CenterEnd
                    SwipeToDismissBoxValue.StartToEnd -> Alignment.CenterStart
                    else -> Alignment.Center
                }
            ) {
                when (direction) {
                    SwipeToDismissBoxValue.EndToStart -> {
                        if (onDelete != null) {
                            Icon(
                                imageVector = Icons.Default.Delete,
                                contentDescription = "Supprimer",
                                tint = iconColor
                            )
                        }
                    }
                    SwipeToDismissBoxValue.StartToEnd -> {
                        if (onEdit != null) {
                            Icon(
                                imageVector = Icons.Default.Edit,
                                contentDescription = "Modifier",
                                tint = iconColor
                            )
                        }
                    }
                    else -> {}
                }
            }
        },
        enableDismissFromStartToEnd = onEdit != null,
        enableDismissFromEndToStart = onDelete != null,
        modifier = modifier
    ) {
        content()
    }
}
