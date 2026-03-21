namespace Pulpe.Api.Domain.Template;

public interface ITemplateRepository
{
    Task<BudgetTemplate?> FindById(Guid id, object supabaseClient);
    Task<List<BudgetTemplate>> FindAll(string userId, object supabaseClient);
    Task<BudgetTemplate> Create(object createDto, object supabaseClient);
    Task<BudgetTemplate> Update(Guid id, object updateDto, object supabaseClient);
    Task Delete(Guid id, object supabaseClient);
    Task<int> CountByUserId(string userId, object supabaseClient);
    Task<List<TemplateLine>> FindTemplateLines(Guid templateId, object supabaseClient);
    Task<TemplateLine> CreateTemplateLine(object createDto, object supabaseClient);
    Task<TemplateLine?> FindTemplateLine(Guid lineId, object supabaseClient);
    Task<TemplateLine> UpdateTemplateLine(Guid lineId, object updateDto, object supabaseClient);
    Task DeleteTemplateLine(Guid lineId, object supabaseClient);
    Task ResetDefaultTemplates(string userId, Guid? excludeId, object supabaseClient);
}
