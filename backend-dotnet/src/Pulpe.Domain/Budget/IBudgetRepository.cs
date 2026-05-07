namespace Pulpe.Domain.Budget;

public interface IBudgetRepository
{
    Task<Budget?> FindById(Guid id);
    Task<List<Budget>> FindAll(string userId);
    Task<Budget> Create(object createDto);
    Task<Budget> Update(Guid id, object updateDto);
    Task Delete(Guid id);
    Task<bool> HasBudgets(string userId);
    Task<bool> ExistsForPeriod(int month, int year, string userId, Guid? excludeId = null);
    Task UpdateEndingBalance(Guid id, string encryptedBalance);
    Task<List<BudgetLine>> FindLinesByBudgetId(Guid budgetId);
}
