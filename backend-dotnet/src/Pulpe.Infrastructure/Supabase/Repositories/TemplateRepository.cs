using Pulpe.Application.Common;
using Pulpe.Domain.Common;
using Pulpe.Domain.Template;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;

namespace Pulpe.Infrastructure.Supabase.Repositories;

public sealed class TemplateRepository : ITemplateRepository
{
    private readonly ISupabaseClientFactory _factory;

    public TemplateRepository(ISupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<BudgetTemplate?> FindById(Guid id)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TemplateRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Single();

        return response is null ? null : MapToTemplate(response);
    }

    public async Task<List<BudgetTemplate>> FindAll(string userId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TemplateRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Order("created_at", Ordering.Descending)
            .Get();

        return response.Models.Select(MapToTemplate).ToList();
    }

    public async Task<BudgetTemplate> Create(object createDto)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Rpc<TemplateRow>("create_template_with_lines", createDto);

        if (response is null)
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateCreateFailed, "Failed to create template");

        return MapToTemplate(response);
    }

    public async Task<BudgetTemplate> Update(Guid id, object updateDto)
    {
        var client = _factory.CreateUserClient();
        var dict = updateDto as Dictionary<string, object?> ?? ToDictionary(updateDto);

        var table = client.Table<TemplateRow>().Filter("id", Operator.Equals, id.ToString());
        if (dict.TryGetValue("name", out var name)) table = table.Set(r => r.Name, name as string);
        if (dict.TryGetValue("description", out var desc)) table = table.Set(r => r.Description, desc as string);
        if (dict.TryGetValue("is_default", out var isDefault)) table = table.Set(r => r.IsDefault, Convert.ToBoolean(isDefault));

        var response = await table.Update();
        var row = response.Models.FirstOrDefault()
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TemplateUpdateFailed, "Failed to update template");

        return MapToTemplate(row);
    }

    public async Task Delete(Guid id)
    {
        var client = _factory.CreateUserClient();
        await client.Table<TemplateRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Delete();
    }

    public async Task<int> CountByUserId(string userId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TemplateRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Get();

        return response.Models.Count;
    }

    public async Task<List<TemplateLine>> FindTemplateLines(Guid templateId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TemplateLineRow>()
            .Filter("template_id", Operator.Equals, templateId.ToString())
            .Order("created_at", Ordering.Ascending)
            .Get();

        return response.Models.Select(MapToTemplateLine).ToList();
    }

    public async Task<TemplateLine> CreateTemplateLine(object createDto)
    {
        var client = _factory.CreateUserClient();
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(createDto);
        var row = Newtonsoft.Json.JsonConvert.DeserializeObject<TemplateLineRow>(json)
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TemplateLineCreateFailed, "Failed to map template line");

        var response = await client.Table<TemplateLineRow>().Insert(row);
        return MapToTemplateLine(response.Models.FirstOrDefault()
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TemplateLineCreateFailed, "Failed to create template line"));
    }

    public async Task<TemplateLine?> FindTemplateLine(Guid lineId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TemplateLineRow>()
            .Filter("id", Operator.Equals, lineId.ToString())
            .Single();

        return response is null ? null : MapToTemplateLine(response);
    }

    public async Task<TemplateLine> UpdateTemplateLine(Guid lineId, object updateDto)
    {
        var client = _factory.CreateUserClient();
        var dict = updateDto as Dictionary<string, object?> ?? ToDictionary(updateDto);

        var table = client.Table<TemplateLineRow>().Filter("id", Operator.Equals, lineId.ToString());
        if (dict.TryGetValue("name", out var name)) table = table.Set(r => r.Name, name as string);
        if (dict.TryGetValue("amount", out var amount)) table = table.Set(r => r.Amount, amount as string);
        if (dict.TryGetValue("description", out var desc)) table = table.Set(r => r.Description, desc as string);
        if (dict.TryGetValue("recurrence", out var rec) && rec is string recStr)
            table = table.Set(r => r.Recurrence, Enum.Parse<Pulpe.Domain.Common.TransactionRecurrence>(recStr, true));
        if (dict.TryGetValue("kind", out var kind) && kind is string kindStr)
            table = table.Set(r => r.Kind, Enum.Parse<Pulpe.Domain.Common.TransactionKind>(kindStr, true));
        if (dict.TryGetValue("original_amount", out var origAmt)) table = table.Set(r => r.OriginalAmount, origAmt as string);
        if (dict.TryGetValue("original_currency", out var origCur)) table = table.Set(r => r.OriginalCurrency, origCur as string);
        if (dict.TryGetValue("target_currency", out var tgtCur)) table = table.Set(r => r.TargetCurrency, tgtCur as string);
        if (dict.TryGetValue("exchange_rate", out var exRate)) table = table.Set(r => r.ExchangeRate, exRate is null ? null : (decimal?)Convert.ToDecimal(exRate));

        var response = await table.Update();
        var row = response.Models.FirstOrDefault()
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TemplateLineUpdateFailed, "Failed to update template line");

        return MapToTemplateLine(row);
    }

    public async Task DeleteTemplateLine(Guid lineId)
    {
        var client = _factory.CreateUserClient();
        await client.Table<TemplateLineRow>()
            .Filter("id", Operator.Equals, lineId.ToString())
            .Delete();
    }

    public async Task ResetDefaultTemplates(string userId, Guid? excludeId)
    {
        var client = _factory.CreateUserClient();
        var query = client.Table<TemplateRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Filter("is_default", Operator.Equals, "true");

        if (excludeId.HasValue)
            query = query.Filter("id", Operator.NotEqual, excludeId.Value.ToString());

        await query.Set(r => r.IsDefault, false).Update();
    }

    private static BudgetTemplate MapToTemplate(TemplateRow row) => new()
    {
        Id = row.Id,
        UserId = row.UserId == Guid.Empty ? null : row.UserId,
        Name = row.Name ?? string.Empty,
        Description = row.Description,
        IsDefault = row.IsDefault,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static TemplateLine MapToTemplateLine(TemplateLineRow row) => new()
    {
        Id = row.Id,
        TemplateId = row.TemplateId,
        Name = row.Name ?? string.Empty,
        Amount = row.Amount ?? string.Empty,
        Description = row.Description,
        Recurrence = row.Recurrence,
        Kind = row.Kind,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt,
        OriginalAmount = row.OriginalAmount,
        OriginalCurrency = row.OriginalCurrency,
        TargetCurrency = row.TargetCurrency,
        ExchangeRate = row.ExchangeRate,
    };

    private static Dictionary<string, object?> ToDictionary(object obj)
    {
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(obj);
        return Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object?>>(json) ?? [];
    }

    [Table("template")]
    private sealed class TemplateRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid? UserId { get; set; }

        [Column("name")]
        public string? Name { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("is_default")]
        public bool IsDefault { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }

    [Table("template_line")]
    private sealed class TemplateLineRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("template_id")]
        public Guid TemplateId { get; set; }

        [Column("name")]
        public string? Name { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("recurrence")]
        public TransactionRecurrence Recurrence { get; set; }

        [Column("kind")]
        public TransactionKind Kind { get; set; }

        [Column("original_amount")]
        public string? OriginalAmount { get; set; }

        [Column("original_currency")]
        public string? OriginalCurrency { get; set; }

        [Column("target_currency")]
        public string? TargetCurrency { get; set; }

        [Column("exchange_rate")]
        public decimal? ExchangeRate { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
