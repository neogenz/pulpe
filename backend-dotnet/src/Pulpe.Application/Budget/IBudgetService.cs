using Pulpe.Domain.User;

namespace Pulpe.Application.Budget;

public interface IBudgetService
{
    Task<object> FindAllAsync(AuthenticatedUser user, object? query = null);
    Task<object> CreateAsync(object dto, AuthenticatedUser user);
    Task<object> ExportAllAsync(AuthenticatedUser user);
    Task<bool> HasBudgetsAsync(AuthenticatedUser user);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user);
    Task<object> FindOneWithDetailsAsync(Guid id, AuthenticatedUser user);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user);
}
