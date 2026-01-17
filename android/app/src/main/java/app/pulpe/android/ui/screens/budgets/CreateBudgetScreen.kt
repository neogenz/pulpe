package app.pulpe.android.ui.screens.budgets

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateBudgetScreen(
    onNavigateBack: () -> Unit,
    onBudgetCreated: (String) -> Unit,
    viewModel: CreateBudgetViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.createdBudgetId) {
        uiState.createdBudgetId?.let { budgetId ->
            onBudgetCreated(budgetId)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Créer un budget") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Retour")
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Month/Year selector
            MonthYearSelector(
                selectedMonth = uiState.month,
                selectedYear = uiState.year,
                onMonthChanged = viewModel::setMonth,
                onYearChanged = viewModel::setYear
            )

            // Description
            OutlinedTextField(
                value = uiState.description,
                onValueChange = viewModel::setDescription,
                label = { Text("Description (optionnel)") },
                modifier = Modifier.fillMaxWidth(),
                maxLines = 2
            )

            // Template selector
            TemplateSelector(
                selectedTemplateId = uiState.selectedTemplateId,
                templates = uiState.availableTemplates,
                onTemplateSelected = viewModel::selectTemplate
            )

            Spacer(modifier = Modifier.weight(1f))

            // Error message
            if (uiState.error != null) {
                Text(
                    text = uiState.error!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall
                )
            }

            // Create button
            Button(
                onClick = viewModel::createBudget,
                modifier = Modifier.fillMaxWidth(),
                enabled = !uiState.isLoading
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Créer le budget")
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun MonthYearSelector(
    selectedMonth: Int,
    selectedYear: Int,
    onMonthChanged: (Int) -> Unit,
    onYearChanged: (Int) -> Unit
) {
    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }

    val months = (1..12).map { month ->
        LocalDate.of(2024, month, 1).month.getDisplayName(TextStyle.FULL, Locale.FRENCH)
            .replaceFirstChar { it.uppercase() }
    }

    val currentYear = LocalDate.now().year
    val years = (currentYear - 1..currentYear + 2).toList()

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Month dropdown
        ExposedDropdownMenuBox(
            expanded = monthExpanded,
            onExpandedChange = { monthExpanded = it },
            modifier = Modifier.weight(1f)
        ) {
            OutlinedTextField(
                value = months[selectedMonth - 1],
                onValueChange = {},
                readOnly = true,
                label = { Text("Mois") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = monthExpanded) },
                modifier = Modifier.menuAnchor()
            )
            ExposedDropdownMenu(
                expanded = monthExpanded,
                onDismissRequest = { monthExpanded = false }
            ) {
                months.forEachIndexed { index, month ->
                    DropdownMenuItem(
                        text = { Text(month) },
                        onClick = {
                            onMonthChanged(index + 1)
                            monthExpanded = false
                        }
                    )
                }
            }
        }

        // Year dropdown
        ExposedDropdownMenuBox(
            expanded = yearExpanded,
            onExpandedChange = { yearExpanded = it },
            modifier = Modifier.weight(1f)
        ) {
            OutlinedTextField(
                value = selectedYear.toString(),
                onValueChange = {},
                readOnly = true,
                label = { Text("Année") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = yearExpanded) },
                modifier = Modifier.menuAnchor()
            )
            ExposedDropdownMenu(
                expanded = yearExpanded,
                onDismissRequest = { yearExpanded = false }
            ) {
                years.forEach { year ->
                    DropdownMenuItem(
                        text = { Text(year.toString()) },
                        onClick = {
                            onYearChanged(year)
                            yearExpanded = false
                        }
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TemplateSelector(
    selectedTemplateId: String?,
    templates: List<app.pulpe.android.domain.model.BudgetTemplate>,
    onTemplateSelected: (String?) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    val selectedTemplate = templates.find { it.id == selectedTemplateId }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it }
    ) {
        OutlinedTextField(
            value = selectedTemplate?.name ?: "Aucun modèle",
            onValueChange = {},
            readOnly = true,
            label = { Text("Modèle (optionnel)") },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor()
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            DropdownMenuItem(
                text = { Text("Aucun modèle") },
                onClick = {
                    onTemplateSelected(null)
                    expanded = false
                }
            )
            templates.forEach { template ->
                DropdownMenuItem(
                    text = { Text(template.name) },
                    onClick = {
                        onTemplateSelected(template.id)
                        expanded = false
                    }
                )
            }
        }
    }
}
