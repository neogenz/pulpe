namespace Pulpe.Api.Domain.Budget;

public interface IBudgetRepository
{
    Task<Budget?> FindById(Guid id, object supabaseClient);
    Task<List<Budget>> FindAll(string userId, object supabaseClient);
    Task<Budget> Create(object createDto, object supabaseClient);
    Task<Budget> Update(Guid id, object updateDto, object supabaseClient);
    Task Delete(Guid id, object supabaseClient);
    Task<bool> HasBudgets(string userId, object supabaseClient);
    Task<bool> ExistsForPeriod(int month, int year, string userId, object supabaseClient, Guid? excludeId = null);
    Task UpdateEndingBalance(Guid id, string encryptedBalance, object supabaseClient);
    Task<List<BudgetLine>> FindLinesByBudgetId(Guid budgetId, object supabaseClient);
}
