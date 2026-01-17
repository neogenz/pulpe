package app.pulpe.android.data.repository

import app.pulpe.android.data.api.PulpeApiService
import app.pulpe.android.domain.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BudgetLineRepository @Inject constructor(
    private val apiService: PulpeApiService
) {
    suspend fun getBudgetLines(budgetId: String): Result<List<BudgetLine>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBudgetLines(budgetId)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération des lignes budgétaires"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createBudgetLine(line: BudgetLineCreate): Result<BudgetLine> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createBudgetLine(line)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de création de la ligne budgétaire"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateBudgetLine(id: String, update: BudgetLineUpdate): Result<BudgetLine> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateBudgetLine(id, update)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de mise à jour de la ligne budgétaire"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteBudgetLine(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.deleteBudgetLine(id)
            if (response.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Échec de suppression de la ligne budgétaire"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun toggleCheck(id: String): Result<BudgetLine> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.toggleBudgetLineCheck(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec du toggle de la ligne budgétaire"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun resetFromTemplate(id: String): Result<BudgetLine> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.resetBudgetLineFromTemplate(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de réinitialisation depuis le modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
