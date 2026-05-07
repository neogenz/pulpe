namespace Pulpe.Domain.Template;

public interface ITemplateRepository
{
    Task<BudgetTemplate?> FindById(Guid id);
    Task<List<BudgetTemplate>> FindAll(string userId);
    Task<BudgetTemplate> Create(object createDto);
    Task<BudgetTemplate> Update(Guid id, object updateDto);
    Task Delete(Guid id);
    Task<int> CountByUserId(string userId);
    Task<List<TemplateLine>> FindTemplateLines(Guid templateId);
    Task<TemplateLine> CreateTemplateLine(object createDto);
    Task<TemplateLine?> FindTemplateLine(Guid lineId);
    Task<TemplateLine> UpdateTemplateLine(Guid lineId, object updateDto);
    Task DeleteTemplateLine(Guid lineId);
    Task ResetDefaultTemplates(string userId, Guid? excludeId);
}
