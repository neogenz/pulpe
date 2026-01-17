package app.pulpe.android.data.repository

import app.pulpe.android.data.api.PulpeApiService
import app.pulpe.android.domain.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TemplateRepository @Inject constructor(
    private val apiService: PulpeApiService
) {
    suspend fun getTemplates(): Result<List<BudgetTemplate>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTemplates()
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération des modèles"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTemplate(id: String): Result<BudgetTemplate> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTemplate(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTemplateUsage(id: String): Result<TemplateUsageData> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTemplateUsage(id)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération de l'utilisation du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTemplate(template: BudgetTemplateCreate): Result<TemplateCreateData> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createTemplate(template)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de création du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createTemplateFromOnboarding(data: BudgetTemplateCreateFromOnboarding): Result<TemplateCreateData> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.createTemplateFromOnboarding(data)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de création du modèle depuis l'onboarding"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateTemplate(id: String, update: BudgetTemplateUpdate): Result<BudgetTemplate> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateTemplate(id, update)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de mise à jour du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteTemplate(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.deleteTemplate(id)
            if (response.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Échec de suppression du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTemplateLines(templateId: String): Result<List<TemplateLine>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.getTemplateLines(templateId)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de récupération des lignes du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun bulkUpdateTemplateLines(
        templateId: String,
        operations: TemplateLinesBulkOperations
    ): Result<List<TemplateLine>> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.bulkUpdateTemplateLines(templateId, operations)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de mise à jour en masse des lignes"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateTemplateLine(id: String, update: TemplateLineUpdate): Result<TemplateLine> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.updateTemplateLine(id, update)
            if (response.success) {
                Result.success(response.data)
            } else {
                Result.failure(Exception("Échec de mise à jour de la ligne du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteTemplateLine(id: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val response = apiService.deleteTemplateLine(id)
            if (response.success) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Échec de suppression de la ligne du modèle"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
