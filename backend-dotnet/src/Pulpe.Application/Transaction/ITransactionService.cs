using Pulpe.Domain.User;

namespace Pulpe.Application.Transaction;

public interface ITransactionService
{
    Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user);
    Task<object> FindByBudgetLineAsync(Guid budgetLineId, AuthenticatedUser user);
    Task<object> SearchAsync(string q, int[]? years, AuthenticatedUser user);
    Task<object> CreateAsync(object dto, AuthenticatedUser user);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user);
    Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user);
}
