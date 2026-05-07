using Pulpe.Domain.User;

namespace Pulpe.Application.BudgetLine;

public interface IBudgetLineService
{
    Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user);
    Task<object> CreateAsync(object dto, AuthenticatedUser user);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user);
    Task<object> ResetFromTemplateAsync(Guid id, AuthenticatedUser user);
    Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user);
    Task<object> CheckTransactionsAsync(Guid id, AuthenticatedUser user);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user);
}
