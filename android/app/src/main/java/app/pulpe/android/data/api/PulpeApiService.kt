package app.pulpe.android.data.api

import app.pulpe.android.domain.model.*
import retrofit2.http.*

interface PulpeApiService {

    // Auth
    @GET("auth/validate")
    suspend fun validateSession(): AuthValidationResponse

    // User
    @GET("users/me")
    suspend fun getUserProfile(): UserProfileResponse

    // Budgets
    @GET("budgets")
    suspend fun getBudgets(): BudgetListResponse

    @POST("budgets")
    suspend fun createBudget(@Body budget: BudgetCreate): BudgetResponse

    @GET("budgets/{id}")
    suspend fun getBudget(@Path("id") id: String): BudgetResponse

    @GET("budgets/{id}/details")
    suspend fun getBudgetDetails(@Path("id") id: String): BudgetDetailsResponse

    @GET("budgets/export")
    suspend fun exportBudgets(): BudgetExportResponse

    @PATCH("budgets/{id}")
    suspend fun updateBudget(
        @Path("id") id: String,
        @Body update: BudgetUpdate
    ): BudgetResponse

    @DELETE("budgets/{id}")
    suspend fun deleteBudget(@Path("id") id: String): DeleteResponse

    // Budget Lines
    @GET("budgets/{budgetId}/lines")
    suspend fun getBudgetLines(@Path("budgetId") budgetId: String): BudgetLineListResponse

    @POST("budget-lines")
    suspend fun createBudgetLine(@Body line: BudgetLineCreate): BudgetLineResponse

    @GET("budget-lines/{id}")
    suspend fun getBudgetLine(@Path("id") id: String): BudgetLineResponse

    @PATCH("budget-lines/{id}")
    suspend fun updateBudgetLine(
        @Path("id") id: String,
        @Body update: BudgetLineUpdate
    ): BudgetLineResponse

    @DELETE("budget-lines/{id}")
    suspend fun deleteBudgetLine(@Path("id") id: String): DeleteResponse

    @POST("budget-lines/{id}/toggle-check")
    suspend fun toggleBudgetLineCheck(@Path("id") id: String): BudgetLineResponse

    @POST("budget-lines/{id}/reset-from-template")
    suspend fun resetBudgetLineFromTemplate(@Path("id") id: String): BudgetLineResponse

    // Transactions
    @GET("transactions/budget/{budgetId}")
    suspend fun getTransactionsByBudget(@Path("budgetId") budgetId: String): TransactionListResponse

    @POST("transactions")
    suspend fun createTransaction(@Body transaction: TransactionCreate): TransactionResponse

    @GET("transactions/{id}")
    suspend fun getTransaction(@Path("id") id: String): TransactionResponse

    @PATCH("transactions/{id}")
    suspend fun updateTransaction(
        @Path("id") id: String,
        @Body update: TransactionUpdate
    ): TransactionResponse

    @DELETE("transactions/{id}")
    suspend fun deleteTransaction(@Path("id") id: String): DeleteResponse

    @POST("transactions/{id}/toggle-check")
    suspend fun toggleTransactionCheck(@Path("id") id: String): TransactionResponse

    // Templates
    @GET("budget-templates")
    suspend fun getTemplates(): BudgetTemplateListResponse

    @POST("budget-templates")
    suspend fun createTemplate(@Body template: BudgetTemplateCreate): BudgetTemplateCreateResponse

    @GET("budget-templates/{id}")
    suspend fun getTemplate(@Path("id") id: String): BudgetTemplateResponse

    @GET("budget-templates/{id}/usage")
    suspend fun getTemplateUsage(@Path("id") id: String): TemplateUsageResponse

    @PATCH("budget-templates/{id}")
    suspend fun updateTemplate(
        @Path("id") id: String,
        @Body update: BudgetTemplateUpdate
    ): BudgetTemplateResponse

    @DELETE("budget-templates/{id}")
    suspend fun deleteTemplate(@Path("id") id: String): DeleteResponse

    @POST("budget-templates/from-onboarding")
    suspend fun createTemplateFromOnboarding(
        @Body data: BudgetTemplateCreateFromOnboarding
    ): BudgetTemplateCreateResponse

    // Template Lines
    @GET("budget-templates/{templateId}/lines")
    suspend fun getTemplateLines(@Path("templateId") templateId: String): TemplateLineListResponse

    @POST("budget-templates/{templateId}/lines/bulk")
    suspend fun bulkUpdateTemplateLines(
        @Path("templateId") templateId: String,
        @Body operations: TemplateLinesBulkOperations
    ): TemplateLineListResponse

    @GET("template-lines/{id}")
    suspend fun getTemplateLine(@Path("id") id: String): TemplateLineResponse

    @PATCH("template-lines/{id}")
    suspend fun updateTemplateLine(
        @Path("id") id: String,
        @Body update: TemplateLineUpdate
    ): TemplateLineResponse

    @DELETE("template-lines/{id}")
    suspend fun deleteTemplateLine(@Path("id") id: String): DeleteResponse
}
