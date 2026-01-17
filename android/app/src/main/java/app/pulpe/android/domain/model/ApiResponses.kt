package app.pulpe.android.domain.model

import kotlinx.serialization.Serializable

/**
 * API response wrappers matching backend format
 */

@Serializable
data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null,
    val message: String? = null
)

@Serializable
data class BudgetListResponse(
    val success: Boolean,
    val data: List<Budget>
)

@Serializable
data class BudgetResponse(
    val success: Boolean,
    val data: Budget
)

@Serializable
data class BudgetDetailsResponse(
    val success: Boolean,
    val data: BudgetDetails
)

@Serializable
data class BudgetExportResponse(
    val success: Boolean,
    val data: BudgetExportData
)

@Serializable
data class BudgetExportData(
    val exportDate: String,
    val totalBudgets: Int,
    val budgets: List<BudgetWithDetails>
)

@Serializable
data class TransactionResponse(
    val success: Boolean,
    val data: Transaction
)

@Serializable
data class TransactionListResponse(
    val success: Boolean,
    val data: List<Transaction>
)

@Serializable
data class BudgetLineResponse(
    val success: Boolean,
    val data: BudgetLine
)

@Serializable
data class BudgetLineListResponse(
    val success: Boolean,
    val data: List<BudgetLine>
)

@Serializable
data class BudgetTemplateResponse(
    val success: Boolean,
    val data: BudgetTemplate
)

@Serializable
data class BudgetTemplateListResponse(
    val success: Boolean,
    val data: List<BudgetTemplate>
)

@Serializable
data class BudgetTemplateCreateResponse(
    val success: Boolean,
    val data: TemplateCreateData
)

@Serializable
data class TemplateCreateData(
    val template: BudgetTemplate,
    val lines: List<TemplateLine>
)

@Serializable
data class TemplateLineResponse(
    val success: Boolean,
    val data: TemplateLine
)

@Serializable
data class TemplateLineListResponse(
    val success: Boolean,
    val data: List<TemplateLine>
)

@Serializable
data class TemplateUsageResponse(
    val success: Boolean,
    val data: TemplateUsageData
)

@Serializable
data class TemplateUsageData(
    val isUsed: Boolean,
    val budgetCount: Int,
    val budgets: List<TemplateUsageBudget>
)

@Serializable
data class TemplateUsageBudget(
    val id: String,
    val month: Int,
    val year: Int,
    val description: String
)

@Serializable
data class DeleteResponse(
    val success: Boolean,
    val message: String
)

@Serializable
data class AuthValidationResponse(
    val success: Boolean,
    val user: UserInfo
)

@Serializable
data class UserInfo(
    val id: String,
    val email: String
)

@Serializable
data class UserProfileResponse(
    val success: Boolean,
    val user: UserProfile
)

@Serializable
data class UserProfile(
    val id: String,
    val email: String,
    val firstName: String? = null,
    val lastName: String? = null,
    val payDayOfMonth: Int? = null
)
