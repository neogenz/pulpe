using Pulpe.Domain.User;

namespace Pulpe.Application.Template;

public interface ITemplateService
{
    Task<object> FindAllAsync(AuthenticatedUser user);
    Task<object> CreateAsync(object dto, AuthenticatedUser user);
    Task<object> CreateFromOnboardingAsync(object dto, AuthenticatedUser user);
    Task<object> CheckUsageAsync(Guid id, AuthenticatedUser user);
    Task<object> FindOneAsync(Guid id, AuthenticatedUser user);
    Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user);
    Task<object> FindTemplateLinesAsync(Guid templateId, AuthenticatedUser user);
    Task<object> BulkUpdateTemplateLinesAsync(Guid templateId, object dto, AuthenticatedUser user);
    Task<object> BulkOperationsTemplateLinesAsync(Guid templateId, object dto, AuthenticatedUser user);
    Task<object> CreateTemplateLineAsync(Guid templateId, object dto, AuthenticatedUser user);
    Task<object> FindTemplateLineAsync(Guid lineId, AuthenticatedUser user);
    Task<object> UpdateTemplateLineAsync(Guid lineId, object dto, AuthenticatedUser user);
    Task<object> DeleteTemplateLineAsync(Guid lineId, AuthenticatedUser user);
    Task<object> RemoveAsync(Guid id, AuthenticatedUser user);
}
