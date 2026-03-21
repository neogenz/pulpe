using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.BudgetLine;

public interface IBudgetLineService
{
    Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> ResetFromTemplateAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CheckTransactionsAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
}
