package app.pulpe.android.data.repository

import app.pulpe.android.data.api.PulpeApiService
import app.pulpe.android.domain.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TransactionRepository @Inject constructor(
    private val apiService: PulpeApiService
) {
    suspend fun getTransactionsByBudget(budgetId: String): Result<List<Transaction>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTransactionsByBudget(budgetId)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération des transactions"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTransaction(transaction: TransactionCreate): Result<Transaction> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createTransaction(transaction)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de création de la transaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTransaction(id: String): Result<Transaction> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTransaction(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération de la transaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateTransaction(id: String, update: TransactionUpdate): Result<Transaction> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateTransaction(id, update)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de mise à jour de la transaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteTransaction(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.deleteTransaction(id)
            if (response.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Échec de suppression de la transaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun toggleCheck(id: String): Result<Transaction> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.toggleTransactionCheck(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec du toggle de la transaction"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
