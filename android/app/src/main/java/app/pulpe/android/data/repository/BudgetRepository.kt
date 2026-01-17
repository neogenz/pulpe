package app.pulpe.android.data.repository

import app.pulpe.android.data.api.PulpeApiService
import app.pulpe.android.domain.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.YearMonth
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BudgetRepository @Inject constructor(
    private val apiService: PulpeApiService
) {
    suspend fun getBudgets(): Result<List<Budget>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBudgets()
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération des budgets"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getCurrentMonthBudget(): Result<Budget?> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBudgets()
            if (response.success) {
                val now = YearMonth.now()
                val currentBudget = response.data.find {
                    it.month == now.monthValue && it.year == now.year
                }
                Result.success(currentBudget)
            } else {
                Result.failure(Exception("Échec de récupération des budgets"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getBudget(id: String): Result<Budget> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBudget(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération du budget"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getBudgetDetails(id: String): Result<BudgetDetails> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getBudgetDetails(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération des détails du budget"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun exportBudgets(): Result<BudgetExportData> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.exportBudgets()
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de l'export des budgets"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createBudget(budget: BudgetCreate): Result<Budget> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createBudget(budget)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de création du budget"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateBudget(id: String, update: BudgetUpdate): Result<Budget> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateBudget(id, update)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de mise à jour du budget"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteBudget(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.deleteBudget(id)
            if (response.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Échec de suppression du budget"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
