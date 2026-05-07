namespace Pulpe.Domain.Transaction;

public interface ITransactionRepository
{
    Task<Transaction?> FindById(Guid id);
    Task<List<Transaction>> FindByBudgetId(Guid budgetId);
    Task<List<Transaction>> FindByBudgetLineId(Guid budgetLineId);
    Task<Transaction> Create(object createDto);
    Task<Transaction> Update(Guid id, object updateDto);
    Task Delete(Guid id);
    Task<Transaction> ToggleCheck(Guid id);
    Task<(List<Transaction> Transactions, List<Domain.Budget.BudgetLine> BudgetLines)> Search(
        string query, string userId, int[]? years = null);
}
