package app.pulpe.android.ui.screens.templates

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
import app.pulpe.android.domain.model.TemplateLine
import app.pulpe.android.domain.model.TransactionKind
import app.pulpe.android.domain.model.TransactionRecurrence
import app.pulpe.android.ui.components.ErrorView
import app.pulpe.android.ui.components.LoadingView
import app.pulpe.android.ui.theme.PulpeTheme
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TemplateDetailsScreen(
    templateId: String,
    onNavigateBack: () -> Unit,
    viewModel: TemplateDetailsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(templateId) {
        viewModel.loadTemplate(templateId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.template?.name ?: "Modèle") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                },
                actions = {
                    if (uiState.template != null) {
                        IconButton(onClick = { /* TODO: Edit */ }) {
                            Icon(Icons.Default.Edit, contentDescription = "Modifier")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (uiState.template != null) {
                FloatingActionButton(
                    onClick = { viewModel.showAddLine() }
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Ajouter une ligne")
                }
            }
        }
    ) { paddingValues ->
        when {
            uiState.isLoading && uiState.template == null -> {
                LoadingView(
                    message = "Chargement du modèle...",
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.error != null && uiState.template == null -> {
                ErrorView(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadTemplate(templateId) },
                    modifier = Modifier.padding(paddingValues)
                )
            }

            uiState.template != null -> {
                PullToRefreshBox(
                    isRefreshing = uiState.isLoading,
                    onRefresh = { viewModel.loadTemplate(templateId) },
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues)
                ) {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        // Template info card
                        item {
                            TemplateInfoCard(
                                name = uiState.template!!.name,
                                description = uiState.template!!.description,
                                isDefault = uiState.template!!.isDefaultTemplate,
                                linesCount = uiState.lines.size
                            )
                        }

                        // Fixed lines section
                        val fixedLines = uiState.lines
                            .filter { it.recurrence == TransactionRecurrence.FIXED }
                        if (fixedLines.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Récurrents",
                                    count = fixedLines.size
                                )
                            }
                            items(fixedLines) { line ->
                                TemplateLineItem(
                                    line = line,
                                    onClick = { /* TODO: Edit */ }
                                )
                            }
                        }

                        // One-off lines section
                        val oneOffLines = uiState.lines
                            .filter { it.recurrence == TransactionRecurrence.ONE_OFF }
                        if (oneOffLines.isNotEmpty()) {
                            item {
                                SectionHeader(
                                    title = "Prévus",
                                    count = oneOffLines.size
                                )
                            }
                            items(oneOffLines) { line ->
                                TemplateLineItem(
                                    line = line,
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
private fun TemplateInfoCard(
    name: String,
    description: String?,
    isDefault: Boolean,
    linesCount: Int
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = name,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                if (isDefault) {
                    Badge(containerColor = MaterialTheme.colorScheme.primary) {
                        Text("Défaut")
                    }
                }
            }

            if (description?.isNotBlank() == true) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSecondaryContainer
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = "$linesCount lignes de prévision",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSecondaryContainer.copy(alpha = 0.7f)
            )
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
private fun TemplateLineItem(
    line: TemplateLine,
    onClick: () -> Unit
) {
    val formatter = NumberFormat.getCurrencyInstance(Locale("fr", "CH")).apply {
        currency = java.util.Currency.getInstance("CHF")
    }

    val color = when (line.kind) {
        TransactionKind.INCOME -> PulpeTheme.colors.financialIncome
        TransactionKind.EXPENSE -> PulpeTheme.colors.financialExpense
        TransactionKind.SAVING -> PulpeTheme.colors.financialSavings
    }

    val icon = when (line.kind) {
        TransactionKind.INCOME -> Icons.Default.ArrowDownward
        TransactionKind.EXPENSE -> Icons.Default.ArrowUpward
        TransactionKind.SAVING -> Icons.Default.Savings
    }

    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
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
                    text = line.name,
                    style = MaterialTheme.typography.bodyLarge
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (line.recurrence == TransactionRecurrence.FIXED) {
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
                        text = line.recurrence.label,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            // Amount
            Text(
                text = formatter.format(line.amount),
                style = MaterialTheme.typography.titleMedium,
                color = color
            )
        }
    }
}
