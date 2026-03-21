using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.Template;

public interface ITemplateService
{
    Task<object> FindAllAsync(AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CreateFromOnboardingAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CheckUsageAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindTemplateLinesAsync(Guid templateId, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> BulkUpdateTemplateLinesAsync(Guid templateId, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> BulkOperationsTemplateLinesAsync(Guid templateId, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> CreateTemplateLineAsync(Guid templateId, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> FindTemplateLineAsync(Guid lineId, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> UpdateTemplateLineAsync(Guid lineId, object dto, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> DeleteTemplateLineAsync(Guid lineId, AuthenticatedUser user, SupabaseRestClient supabase);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase);
}
