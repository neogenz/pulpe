package app.pulpe.android.ui.screens.templates

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pulpe.android.domain.model.BudgetTemplate
import app.pulpe.android.ui.components.EmptyStateView
import app.pulpe.android.ui.components.ErrorView
import app.pulpe.android.ui.components.LoadingView

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemplateListScreen(
    onNavigateToTemplate: (String) -> Unit,
    onNavigateToCreateTemplate: () -> Unit,
    viewModel: TemplateListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadTemplates()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Modèles") },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCreateTemplate) {
                Icon(Icons.Default.Add, contentDescription = "Créer un modèle")
            }
        }
    ) { paddingValues ->
        when {
            uiState.isLoading && uiState.templates.isEmpty() -> {
                LoadingView(
                    message = "Chargement des modèles...",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.error != null && uiState.templates.isEmpty() -> {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadTemplates() },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.templates.isEmpty() -> {
                EmptyStateView(
                    title = "Aucun modèle",
                    description = "Crée un modèle pour gagner du temps lors de la création de budgets",
                    iconName = "file_copy",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            else -> {
                PullToRefreshBox(
                    isRefreshing = uiState.isLoading,
                    onRefresh = { viewModel.loadTemplates() },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(uiState.templates) { template ->
                            TemplateListItem(
                                template = template,
                                onClick = { onNavigateToTemplate(template.id) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TemplateListItem(
    template: BudgetTemplate,
    onClick: () -> Unit
) {
    // Expressive press animation with spring physics
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.98f else 1f,
        animationSpec = spring(dampingRatio = 0.4f, stiffness = 400f),
        label = "scale"
    )

    OutlinedCard(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            },
        shape = RoundedCornerShape(24.dp),
        interactionSource = interactionSource
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon with rounded shape
            Surface(
                color = MaterialTheme.colorScheme.secondaryContainer,
                shape = RoundedCornerShape(50),
                modifier = Modifier.size(44.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Default.Description,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSecondaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Details
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = template.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                if (template.description?.isNotBlank() == true) {
                    Text(
                        text = template.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Default badge
            if (template.isDefaultTemplate) {
                Badge(
                    containerColor = MaterialTheme.colorScheme.primary
                ) {
                    Text("Défaut")
                }
            }
        }
    }
}
