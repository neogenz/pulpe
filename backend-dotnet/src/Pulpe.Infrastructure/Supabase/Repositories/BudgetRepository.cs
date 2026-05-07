using Pulpe.Application.Common;
using Newtonsoft.Json;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;

namespace Pulpe.Infrastructure.Supabase.Repositories;

public sealed class BudgetRepository : IBudgetRepository
{
    private readonly ISupabaseClientFactory _factory;

    public BudgetRepository(ISupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<Budget?> FindById(Guid id)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<BudgetRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Single();

        return response is null ? null : MapToBudget(response);
    }

    public async Task<List<Budget>> FindAll(string userId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<BudgetRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Order("year", Ordering.Descending)
            .Order("month", Ordering.Descending)
            .Get();

        return response.Models.Select(MapToBudget).ToList();
    }

    public async Task<Budget> Create(object createDto)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Rpc<BudgetRow>("create_budget_from_template", createDto);

        if (response is null)
            throw new Domain.Common.BusinessException(ErrorCodes.BudgetCreateFailed, "Failed to create budget");

        return MapToBudget(response);
    }

    public async Task<Budget> Update(Guid id, object updateDto)
    {
        var client = _factory.CreateUserClient();
        var dict = updateDto as Dictionary<string, object?> ?? ToDictionary(updateDto);

        var table = client.Table<BudgetRow>().Filter("id", Operator.Equals, id.ToString());
        if (dict.TryGetValue("description", out var desc)) table = table.Set(r => r.Description, desc as string);
        if (dict.TryGetValue("month", out var month)) table = table.Set(r => r.Month, Convert.ToInt32(month));
        if (dict.TryGetValue("year", out var year)) table = table.Set(r => r.Year, Convert.ToInt32(year));

        var response = await table.Update();
        var row = response.Models.FirstOrDefault()
            ?? throw new Domain.Common.BusinessException(ErrorCodes.BudgetUpdateFailed, "Failed to update budget");

        return MapToBudget(row);
    }

    public async Task Delete(Guid id)
    {
        var client = _factory.CreateUserClient();
        await client.Table<BudgetRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Delete();
    }

    public async Task<bool> HasBudgets(string userId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<BudgetRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Limit(1)
            .Get();

        return response.Models.Count > 0;
    }

    public async Task<bool> ExistsForPeriod(int month, int year, string userId, Guid? excludeId = null)
    {
        var client = _factory.CreateUserClient();
        var query = client.Table<BudgetRow>()
            .Filter("month", Operator.Equals, month.ToString())
            .Filter("year", Operator.Equals, year.ToString())
            .Filter("user_id", Operator.Equals, userId);

        if (excludeId.HasValue)
            query = query.Filter("id", Operator.NotEqual, excludeId.Value.ToString());

        var response = await query.Limit(1).Get();
        return response.Models.Count > 0;
    }

    public async Task UpdateEndingBalance(Guid id, string encryptedBalance)
    {
        var client = _factory.CreateUserClient();
        await client.Table<BudgetRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Set(r => r.EndingBalance, encryptedBalance)
            .Update();
    }

    public async Task<List<BudgetLine>> FindLinesByBudgetId(Guid budgetId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<BudgetLineRow>()
            .Filter("budget_id", Operator.Equals, budgetId.ToString())
            .Order("created_at", Ordering.Ascending)
            .Get();

        return response.Models.Select(MapToBudgetLine).ToList();
    }

    private static Budget MapToBudget(BudgetRow row) => new()
    {
        Id = row.Id,
        Month = row.Month,
        Year = row.Year,
        Description = row.Description ?? string.Empty,
        EndingBalance = row.EndingBalance,
        TemplateId = row.TemplateId == Guid.Empty ? null : row.TemplateId,
        UserId = row.UserId,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static BudgetLine MapToBudgetLine(BudgetLineRow row) => new()
    {
        Id = row.Id,
        BudgetId = row.BudgetId,
        TemplateLineId = row.TemplateLineId == Guid.Empty ? null : row.TemplateLineId,
        SavingsGoalId = row.SavingsGoalId == Guid.Empty ? null : row.SavingsGoalId,
        Name = row.Name ?? string.Empty,
        Amount = row.Amount ?? string.Empty,
        Recurrence = row.Recurrence,
        Kind = row.Kind,
        IsManuallyAdjusted = row.IsManuallyAdjusted,
        CheckedAt = row.CheckedAt,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static Dictionary<string, object?> ToDictionary(object obj)
    {
        var json = JsonConvert.SerializeObject(obj);
        return JsonConvert.DeserializeObject<Dictionary<string, object?>>(json) ?? [];
    }

    [Table("monthly_budget")]
    private sealed class BudgetRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }

        [Column("month")]
        public int Month { get; set; }

        [Column("year")]
        public int Year { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("ending_balance")]
        public string? EndingBalance { get; set; }

        [Column("template_id")]
        public Guid? TemplateId { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }

    [Table("budget_line")]
    private sealed class BudgetLineRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("budget_id")]
        public Guid BudgetId { get; set; }

        [Column("template_line_id")]
        public Guid? TemplateLineId { get; set; }

        [Column("savings_goal_id")]
        public Guid? SavingsGoalId { get; set; }

        [Column("name")]
        public string? Name { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("recurrence")]
        public TransactionRecurrence Recurrence { get; set; }

        [Column("kind")]
        public TransactionKind Kind { get; set; }

        [Column("is_manually_adjusted")]
        public bool IsManuallyAdjusted { get; set; }

        [Column("checked_at")]
        public DateTimeOffset? CheckedAt { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
