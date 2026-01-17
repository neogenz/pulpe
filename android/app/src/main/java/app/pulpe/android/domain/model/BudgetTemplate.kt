package app.pulpe.android.domain.model

import kotlinx.serialization.Serializable

/**
 * Budget template that can be used to create monthly budgets
 */
@Serializable
data class BudgetTemplate(
    val id: String,
    val name: String,
    val description: String? = null,
    val userId: String? = null,
    val isDefault: Boolean? = null,
    val createdAt: String,
    val updatedAt: String
) {
    val isDefaultTemplate: Boolean
        get() = isDefault == true
}

/**
 * Template line representing a planned item in a template
 */
@Serializable
data class TemplateLine(
    val id: String,
    val templateId: String,
    val name: String,
    val amount: Double,
    val kind: TransactionKind,
    val recurrence: TransactionRecurrence,
    val description: String,
    val createdAt: String,
    val updatedAt: String
)

/**
 * Template creation DTO
 */
@Serializable
data class BudgetTemplateCreate(
    val name: String,
    val description: String? = null,
    val isDefault: Boolean = false,
    val lines: List<TemplateLineCreate> = emptyList()
)

/**
 * Template update DTO
 */
@Serializable
data class BudgetTemplateUpdate(
    val name: String? = null,
    val description: String? = null,
    val isDefault: Boolean? = null
)

/**
 * Template line creation DTO
 */
@Serializable
data class TemplateLineCreate(
    val name: String,
    val amount: Double,
    val kind: TransactionKind,
    val recurrence: TransactionRecurrence,
    val description: String = ""
)

/**
 * Template line update DTO
 */
@Serializable
data class TemplateLineUpdate(
    val name: String? = null,
    val amount: Double? = null,
    val kind: TransactionKind? = null,
    val recurrence: TransactionRecurrence? = null,
    val description: String? = null
)

/**
 * Bulk operations for template lines
 */
@Serializable
data class TemplateLinesBulkOperations(
    val create: List<TemplateLineCreate> = emptyList(),
    val update: List<TemplateLineUpdateWithId> = emptyList(),
    val delete: List<String> = emptyList(),
    val propagateToBudgets: Boolean = false
)

@Serializable
data class TemplateLineUpdateWithId(
    val id: String,
    val name: String? = null,
    val amount: Double? = null,
    val kind: TransactionKind? = null,
    val recurrence: TransactionRecurrence? = null,
    val description: String? = null
)

/**
 * Template creation from onboarding
 */
@Serializable
data class BudgetTemplateCreateFromOnboarding(
    val name: String = "Mois Standard",
    val description: String? = null,
    val isDefault: Boolean = true,
    val monthlyIncome: Double? = null,
    val housingCosts: Double? = null,
    val healthInsurance: Double? = null,
    val leasingCredit: Double? = null,
    val phonePlan: Double? = null,
    val transportCosts: Double? = null,
    val customTransactions: List<OnboardingTransaction> = emptyList()
)

@Serializable
data class OnboardingTransaction(
    val amount: Double,
    val type: TransactionKind,
    val name: String,
    val description: String? = null,
    val expenseType: TransactionRecurrence,
    val isRecurring: Boolean
)
