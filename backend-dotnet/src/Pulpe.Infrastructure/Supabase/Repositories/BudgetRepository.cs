using System.Text.Json.Serialization;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;

namespace Pulpe.Infrastructure.Supabase.Repositories;

public sealed class BudgetRepository : IBudgetRepository
{
    private readonly SupabaseClientFactory _factory;

    public BudgetRepository(SupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<Budget?> FindById(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Select("*")
            .Eq("id", id.ToString())
            .Single();

        var response = await client.Execute<BudgetRow>(builder);
        return response.Data is null ? null : MapToBudget(response.Data);
    }

    public async Task<List<Budget>> FindAll(string userId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Select("*")
            .Eq("user_id", userId)
            .Order("year", ascending: false)
            .Order("month", ascending: false);

        var response = await client.Execute<List<BudgetRow>>(builder);
        return response.Data?.Select(MapToBudget).ToList() ?? [];
    }

    public async Task<Budget> Create(object createDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var response = await client.Rpc<BudgetRow>("create_budget_from_template", createDto);

        if (!response.IsSuccess || response.Data is null)
        {
            var code = response.Error?.Code;
            if (code == "23505") throw new Domain.Common.BusinessException(ErrorCodes.BudgetAlreadyExists, "Budget already exists for this period", 409);
            if (code == "P0001") throw new Domain.Common.BusinessException(ErrorCodes.BudgetCreateFailed, response.Error?.Message ?? "Failed to create budget");
            throw new Domain.Common.BusinessException(ErrorCodes.BudgetCreateFailed, response.Error?.Message ?? "Failed to create budget");
        }

        return MapToBudget(response.Data);
    }

    public async Task<Budget> Update(Guid id, object updateDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Eq("id", id.ToString())
            .Update(updateDto);

        var response = await client.Execute<List<BudgetRow>>(builder);
        var row = response.Data?.FirstOrDefault();
        if (!response.IsSuccess || row is null)
            throw new Domain.Common.BusinessException(ErrorCodes.BudgetUpdateFailed, response.Error?.Message ?? "Failed to update budget");

        return MapToBudget(row);
    }

    public async Task Delete(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Eq("id", id.ToString())
            .Delete();

        var response = await client.Execute<object>(builder);
        if (!response.IsSuccess)
            throw new Domain.Common.BusinessException(ErrorCodes.BudgetDeleteFailed, response.Error?.Message ?? "Failed to delete budget");
    }

    public async Task<bool> HasBudgets(string userId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Select("id")
            .Eq("user_id", userId)
            .Limit(1);

        var response = await client.Execute<List<IdRow>>(builder);
        return response.Data?.Count > 0;
    }

    public async Task<bool> ExistsForPeriod(int month, int year, string userId, object supabaseClient, Guid? excludeId = null)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Select("id")
            .Eq("month", month.ToString())
            .Eq("year", year.ToString())
            .Eq("user_id", userId)
            .Limit(1);

        if (excludeId.HasValue)
            builder.Neq("id", excludeId.Value.ToString());

        var response = await client.Execute<List<IdRow>>(builder);
        return response.Data?.Count > 0;
    }

    public async Task UpdateEndingBalance(Guid id, string encryptedBalance, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("monthly_budget")
            .Eq("id", id.ToString())
            .Update(new { ending_balance = encryptedBalance });

        var response = await client.Execute<object>(builder);
        if (!response.IsSuccess)
            throw new Domain.Common.BusinessException(ErrorCodes.BudgetUpdateFailed, response.Error?.Message ?? "Failed to update ending balance");
    }

    public async Task<List<BudgetLine>> FindLinesByBudgetId(Guid budgetId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("budget_line")
            .Select("*")
            .Eq("budget_id", budgetId.ToString())
            .Order("created_at", ascending: true);

        var response = await client.Execute<List<BudgetLineRow>>(builder);
        return response.Data?.Select(MapToBudgetLine).ToList() ?? [];
    }

    private static SupabaseRestClient CastClient(object supabaseClient) =>
        supabaseClient as SupabaseRestClient
            ?? throw new ArgumentException("Expected SupabaseRestClient", nameof(supabaseClient));

    private static Budget MapToBudget(BudgetRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        Month = row.Month,
        Year = row.Year,
        Description = row.Description ?? string.Empty,
        EndingBalance = row.EndingBalance,
        TemplateId = row.TemplateId is not null ? Guid.Parse(row.TemplateId) : null,
        UserId = Guid.Parse(row.UserId),
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static BudgetLine MapToBudgetLine(BudgetLineRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        BudgetId = Guid.Parse(row.BudgetId),
        TemplateLineId = row.TemplateLineId is not null ? Guid.Parse(row.TemplateLineId) : null,
        SavingsGoalId = row.SavingsGoalId is not null ? Guid.Parse(row.SavingsGoalId) : null,
        Name = row.Name ?? string.Empty,
        Amount = row.Amount ?? string.Empty,
        Recurrence = row.Recurrence,
        Kind = row.Kind,
        IsManuallyAdjusted = row.IsManuallyAdjusted,
        CheckedAt = row.CheckedAt,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private sealed class BudgetRow
    {
        public string Id { get; set; } = string.Empty;
        public int Month { get; set; }
        public int Year { get; set; }
        public string? Description { get; set; }
        public string? EndingBalance { get; set; }
        public string? TemplateId { get; set; }
        public string UserId { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class BudgetLineRow
    {
        public string Id { get; set; } = string.Empty;
        public string BudgetId { get; set; } = string.Empty;
        public string? TemplateLineId { get; set; }
        public string? SavingsGoalId { get; set; }
        public string? Name { get; set; }
        public string? Amount { get; set; }
        public TransactionRecurrence Recurrence { get; set; }
        public TransactionKind Kind { get; set; }
        public bool IsManuallyAdjusted { get; set; }
        public DateTimeOffset? CheckedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class IdRow
    {
        public string Id { get; set; } = string.Empty;
    }
}
