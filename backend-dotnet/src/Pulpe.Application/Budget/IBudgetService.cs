using Pulpe.Domain.User;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Infrastructure.Services.Budget;

public interface IBudgetService
{
    Task<object> FindAllAsync(AuthenticatedUser user, SupabaseRestClient supabase, object? query = null);
    Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> ExportAllAsync(AuthenticatedUser user, SupabaseRestClient supabase);
    Task<bool> HasBudgetsAsync(AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindOneWithDetailsAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
}
