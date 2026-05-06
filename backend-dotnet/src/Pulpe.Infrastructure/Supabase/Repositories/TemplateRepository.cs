using Pulpe.Domain.Common;
using Pulpe.Domain.Template;

namespace Pulpe.Infrastructure.Supabase.Repositories;

public sealed class TemplateRepository : ITemplateRepository
{
    private readonly SupabaseClientFactory _factory;

    public TemplateRepository(SupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<BudgetTemplate?> FindById(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template")
            .Select("*")
            .Eq("id", id.ToString())
            .Single();

        var response = await client.Execute<TemplateRow>(builder);
        return response.Data is null ? null : MapToTemplate(response.Data);
    }

    public async Task<List<BudgetTemplate>> FindAll(string userId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template")
            .Select("*")
            .Eq("user_id", userId)
            .Order("created_at", ascending: false);

        var response = await client.Execute<List<TemplateRow>>(builder);
        return response.Data?.Select(MapToTemplate).ToList() ?? [];
    }

    public async Task<BudgetTemplate> Create(object createDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var response = await client.Rpc<TemplateRow>("create_template_with_lines", createDto);

        if (!response.IsSuccess || response.Data is null)
        {
            var code = response.Error?.Code;
            if (code == "P0001")
                throw new Domain.Common.BusinessException(ErrorCodes.TemplateCreateFailed, response.Error?.Message ?? "Failed to create template");
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateCreateFailed, response.Error?.Message ?? "Failed to create template");
        }

        return MapToTemplate(response.Data);
    }

    public async Task<BudgetTemplate> Update(Guid id, object updateDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template")
            .Eq("id", id.ToString())
            .Update(updateDto);

        var response = await client.Execute<List<TemplateRow>>(builder);
        var row = response.Data?.FirstOrDefault();
        if (!response.IsSuccess || row is null)
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateUpdateFailed, response.Error?.Message ?? "Failed to update template");

        return MapToTemplate(row);
    }

    public async Task Delete(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template")
            .Eq("id", id.ToString())
            .Delete();

        var response = await client.Execute<object>(builder);
        if (!response.IsSuccess)
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateDeleteFailed, response.Error?.Message ?? "Failed to delete template");
    }

    public async Task<int> CountByUserId(string userId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template")
            .Select("id")
            .Eq("user_id", userId);

        var response = await client.Execute<List<IdRow>>(builder);
        return response.Data?.Count ?? 0;
    }

    public async Task<List<TemplateLine>> FindTemplateLines(Guid templateId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template_line")
            .Select("*")
            .Eq("template_id", templateId.ToString())
            .Order("created_at", ascending: true);

        var response = await client.Execute<List<TemplateLineRow>>(builder);
        return response.Data?.Select(MapToTemplateLine).ToList() ?? [];
    }

    public async Task<TemplateLine> CreateTemplateLine(object createDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template_line").Insert(createDto);

        var response = await client.Execute<List<TemplateLineRow>>(builder);
        var row = response.Data?.FirstOrDefault();
        if (!response.IsSuccess || row is null)
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateLineCreateFailed, response.Error?.Message ?? "Failed to create template line");

        return MapToTemplateLine(row);
    }

    public async Task<TemplateLine?> FindTemplateLine(Guid lineId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template_line")
            .Select("*")
            .Eq("id", lineId.ToString())
            .Single();

        var response = await client.Execute<TemplateLineRow>(builder);
        return response.Data is null ? null : MapToTemplateLine(response.Data);
    }

    public async Task<TemplateLine> UpdateTemplateLine(Guid lineId, object updateDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template_line")
            .Eq("id", lineId.ToString())
            .Update(updateDto);

        var response = await client.Execute<List<TemplateLineRow>>(builder);
        var row = response.Data?.FirstOrDefault();
        if (!response.IsSuccess || row is null)
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateLineUpdateFailed, response.Error?.Message ?? "Failed to update template line");

        return MapToTemplateLine(row);
    }

    public async Task DeleteTemplateLine(Guid lineId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template_line")
            .Eq("id", lineId.ToString())
            .Delete();

        var response = await client.Execute<object>(builder);
        if (!response.IsSuccess)
            throw new Domain.Common.BusinessException(ErrorCodes.TemplateLineDeleteFailed, response.Error?.Message ?? "Failed to delete template line");
    }

    public async Task ResetDefaultTemplates(string userId, Guid? excludeId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("template")
            .Eq("user_id", userId)
            .Eq("is_default", "true");

        if (excludeId.HasValue)
            builder.Neq("id", excludeId.Value.ToString());

        builder.Update(new { is_default = false });

        await client.Execute<object>(builder);
    }

    private static SupabaseRestClient CastClient(object supabaseClient) =>
        supabaseClient as SupabaseRestClient
            ?? throw new ArgumentException("Expected SupabaseRestClient", nameof(supabaseClient));

    private static BudgetTemplate MapToTemplate(TemplateRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        UserId = row.UserId is not null ? Guid.Parse(row.UserId) : null,
        Name = row.Name ?? string.Empty,
        Description = row.Description,
        IsDefault = row.IsDefault,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static TemplateLine MapToTemplateLine(TemplateLineRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        TemplateId = Guid.Parse(row.TemplateId),
        Name = row.Name ?? string.Empty,
        Amount = row.Amount ?? string.Empty,
        Description = row.Description,
        Recurrence = row.Recurrence,
        Kind = row.Kind,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private sealed class TemplateRow
    {
        public string Id { get; set; } = string.Empty;
        public string? UserId { get; set; }
        public string? Name { get; set; }
        public string? Description { get; set; }
        public bool IsDefault { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class TemplateLineRow
    {
        public string Id { get; set; } = string.Empty;
        public string TemplateId { get; set; } = string.Empty;
        public string? Name { get; set; }
        public string? Amount { get; set; }
        public string? Description { get; set; }
        public TransactionRecurrence Recurrence { get; set; }
        public TransactionKind Kind { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class IdRow
    {
        public string Id { get; set; } = string.Empty;
    }
}
