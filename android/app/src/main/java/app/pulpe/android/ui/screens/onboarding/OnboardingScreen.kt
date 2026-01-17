package app.pulpe.android.ui.screens.onboarding

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import app.pulpe.android.domain.model.TransactionKind
import app.pulpe.android.domain.model.TransactionRecurrence
import app.pulpe.android.ui.theme.PulpeTheme
import java.math.BigDecimal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(
    onOnboardingComplete: () -> Unit,
    onNavigateToLogin: () -> Unit,
    viewModel: OnboardingViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(uiState.isComplete) {
        if (uiState.isComplete) {
            onOnboardingComplete()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Configuration initiale") },
                navigationIcon = {
                    if (uiState.currentStep > 0) {
                        IconButton(onClick = viewModel::previousStep) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Précédent")
                        }
                    }
                }
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Progress indicator
            LinearProgressIndicator(
                progress = { (uiState.currentStep + 1).toFloat() / 4f },
                modifier = Modifier.fillMaxWidth()
            )

            // Step content
            AnimatedContent(
                targetState = uiState.currentStep,
                transitionSpec = {
                    if (targetState > initialState) {
                        slideInHorizontally { it } + fadeIn() togetherWith slideOutHorizontally { -it } + fadeOut()
                    } else {
                        slideInHorizontally { -it } + fadeIn() togetherWith slideOutHorizontally { it } + fadeOut()
                    }
                },
                modifier = Modifier.weight(1f),
                label = "step_content"
            ) { step ->
                when (step) {
                    0 -> WelcomeStep(
                        onNext = viewModel::nextStep,
                        onNavigateToLogin = onNavigateToLogin
                    )
                    1 -> IncomeStep(
                        incomeLines = uiState.incomeLines,
                        onAddLine = viewModel::addIncomeLine,
                        onRemoveLine = viewModel::removeIncomeLine,
                        onNext = viewModel::nextStep
                    )
                    2 -> ExpenseStep(
                        expenseLines = uiState.expenseLines,
                        onAddLine = viewModel::addExpenseLine,
                        onRemoveLine = viewModel::removeExpenseLine,
                        onNext = viewModel::nextStep
                    )
                    3 -> SummaryStep(
                        incomeLines = uiState.incomeLines,
                        expenseLines = uiState.expenseLines,
                        isLoading = uiState.isLoading,
                        error = uiState.error,
                        onComplete = viewModel::complete
                    )
                }
            }
        }
    }
}

@Composable
private fun WelcomeStep(
    onNext: () -> Unit,
    onNavigateToLogin: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Savings,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = MaterialTheme.colorScheme.primary
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Bienvenue sur Pulpe !",
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Configurons ensemble ton premier budget mensuel. Cela ne prendra que quelques minutes.",
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(48.dp))

        Button(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Commencer")
            Spacer(modifier = Modifier.width(8.dp))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
        }

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Déjà un compte ?",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        TextButton(onClick = onNavigateToLogin) {
            Text("Se connecter")
        }
    }
}

@Composable
private fun IncomeStep(
    incomeLines: List<OnboardingLine>,
    onAddLine: (String, BigDecimal, TransactionRecurrence) -> Unit,
    onRemoveLine: (Int) -> Unit,
    onNext: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var recurrence by remember { mutableStateOf(TransactionRecurrence.FIXED) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        Text(
            text = "Tes revenus",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "Ajoute tes sources de revenus mensuels",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Add form
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Nom") },
            placeholder = { Text("Ex: Salaire") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = amount,
            onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } },
            label = { Text("Montant (CHF)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        RecurrenceSelector(
            selected = recurrence,
            onSelect = { recurrence = it }
        )

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = {
                val amountValue = amount.toBigDecimalOrNull()
                if (name.isNotBlank() && amountValue != null && amountValue > BigDecimal.ZERO) {
                    onAddLine(name, amountValue, recurrence)
                    name = ""
                    amount = ""
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = name.isNotBlank() && amount.toBigDecimalOrNull() != null
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Ajouter")
        }

        Spacer(modifier = Modifier.height(24.dp))

        // List of added lines
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            incomeLines.forEachIndexed { index, line ->
                OnboardingLineItem(
                    line = line,
                    color = PulpeTheme.colors.financialIncome,
                    onRemove = { onRemoveLine(index) }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth(),
            enabled = incomeLines.isNotEmpty()
        ) {
            Text("Continuer")
            Spacer(modifier = Modifier.width(8.dp))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
        }
    }
}

@Composable
private fun ExpenseStep(
    expenseLines: List<OnboardingLine>,
    onAddLine: (String, BigDecimal, TransactionRecurrence) -> Unit,
    onRemoveLine: (Int) -> Unit,
    onNext: () -> Unit
) {
    var name by remember { mutableStateOf("") }
    var amount by remember { mutableStateOf("") }
    var recurrence by remember { mutableStateOf(TransactionRecurrence.FIXED) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        Text(
            text = "Tes dépenses",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "Ajoute tes dépenses récurrentes et prévues",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Add form
        OutlinedTextField(
            value = name,
            onValueChange = { name = it },
            label = { Text("Nom") },
            placeholder = { Text("Ex: Loyer") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = amount,
            onValueChange = { amount = it.filter { c -> c.isDigit() || c == '.' } },
            label = { Text("Montant (CHF)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        RecurrenceSelector(
            selected = recurrence,
            onSelect = { recurrence = it }
        )

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = {
                val amountValue = amount.toBigDecimalOrNull()
                if (name.isNotBlank() && amountValue != null && amountValue > BigDecimal.ZERO) {
                    onAddLine(name, amountValue, recurrence)
                    name = ""
                    amount = ""
                }
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = name.isNotBlank() && amount.toBigDecimalOrNull() != null
        ) {
            Icon(Icons.Default.Add, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Ajouter")
        }

        Spacer(modifier = Modifier.height(24.dp))

        // List of added lines
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            expenseLines.forEachIndexed { index, line ->
                OnboardingLineItem(
                    line = line,
                    color = PulpeTheme.colors.financialExpense,
                    onRemove = { onRemoveLine(index) }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onNext,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Continuer")
            Spacer(modifier = Modifier.width(8.dp))
            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null)
        }
    }
}

@Composable
private fun SummaryStep(
    incomeLines: List<OnboardingLine>,
    expenseLines: List<OnboardingLine>,
    isLoading: Boolean,
    error: String?,
    onComplete: () -> Unit
) {
    val totalIncome = incomeLines.sumOf { it.amount }
    val totalExpenses = expenseLines.sumOf { it.amount }
    val remaining = totalIncome - totalExpenses

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        Text(
            text = "Récapitulatif",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold
        )

        Text(
            text = "Voici ton budget mensuel",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Summary cards
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = PulpeTheme.colors.financialIncome.copy(alpha = 0.12f)
            )
        ) {
            Row(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Revenus (${incomeLines.size})")
                Text(
                    text = "CHF ${totalIncome.setScale(2)}",
                    color = PulpeTheme.colors.financialIncome,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = PulpeTheme.colors.financialExpense.copy(alpha = 0.12f)
            )
        ) {
            Row(
                modifier = Modifier
                    .padding(16.dp)
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text("Dépenses (${expenseLines.size})")
                Text(
                    text = "CHF ${totalExpenses.setScale(2)}",
                    color = PulpeTheme.colors.financialExpense,
                    fontWeight = FontWeight.Bold
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        HorizontalDivider()

        Spacer(modifier = Modifier.height(24.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Disponible",
                style = MaterialTheme.typography.titleMedium
            )
            Text(
                text = "CHF ${remaining.setScale(2)}",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = if (remaining >= BigDecimal.ZERO) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.error
                }
            )
        }

        Spacer(modifier = Modifier.weight(1f))

        if (error != null) {
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall
            )
            Spacer(modifier = Modifier.height(16.dp))
        }

        Button(
            onClick = onComplete,
            modifier = Modifier.fillMaxWidth(),
            enabled = !isLoading
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(20.dp),
                    strokeWidth = 2.dp
                )
            } else {
                Icon(Icons.Default.Check, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Créer mon budget")
            }
        }
    }
}

@Composable
private fun RecurrenceSelector(
    selected: TransactionRecurrence,
    onSelect: (TransactionRecurrence) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        TransactionRecurrence.entries.forEach { recurrence ->
            FilterChip(
                selected = selected == recurrence,
                onClick = { onSelect(recurrence) },
                label = { Text(recurrence.label) },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun OnboardingLineItem(
    line: OnboardingLine,
    color: androidx.compose.ui.graphics.Color,
    onRemove: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth()
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = line.name,
                    style = MaterialTheme.typography.bodyLarge
                )
                Text(
                    text = line.recurrence.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Text(
                text = "CHF ${line.amount.setScale(2)}",
                color = color,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(modifier = Modifier.width(8.dp))
            IconButton(onClick = onRemove) {
                Icon(
                    imageVector = Icons.Default.Close,
                    contentDescription = "Supprimer",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}
