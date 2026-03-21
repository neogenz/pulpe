using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.Transaction;

public interface ITransactionService
{
    Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindByBudgetLineAsync(Guid budgetLineId, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> SearchAsync(string q, int[]? years, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
}
