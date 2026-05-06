namespace Pulpe.Domain.Transaction;

public interface ITransactionRepository
{
    Task<Transaction?> FindById(Guid id, object supabaseClient);
    Task<List<Transaction>> FindByBudgetId(Guid budgetId, object supabaseClient);
    Task<List<Transaction>> FindByBudgetLineId(Guid budgetLineId, object supabaseClient);
    Task<Transaction> Create(object createDto, object supabaseClient);
    Task<Transaction> Update(Guid id, object updateDto, object supabaseClient);
    Task Delete(Guid id, object supabaseClient);
    Task<Transaction> ToggleCheck(Guid id, object supabaseClient);
    Task<(List<Transaction> Transactions, List<Domain.Budget.BudgetLine> BudgetLines)> Search(
        string query, string userId, object supabaseClient, int[]? years = null);
}
