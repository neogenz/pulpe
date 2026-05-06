using Pulpe.Application.Common;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Transaction;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;

namespace Pulpe.Infrastructure.Supabase.Repositories;

public sealed class TransactionRepository : ITransactionRepository
{
    private readonly ISupabaseClientFactory _factory;

    public TransactionRepository(ISupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<Transaction?> FindById(Guid id)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TransactionRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Single();

        return response is null ? null : MapToTransaction(response);
    }

    public async Task<List<Transaction>> FindByBudgetId(Guid budgetId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TransactionRow>()
            .Filter("budget_id", Operator.Equals, budgetId.ToString())
            .Order("transaction_date", Ordering.Descending)
            .Get();

        return response.Models.Select(MapToTransaction).ToList();
    }

    public async Task<List<Transaction>> FindByBudgetLineId(Guid budgetLineId)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Table<TransactionRow>()
            .Filter("budget_line_id", Operator.Equals, budgetLineId.ToString())
            .Order("transaction_date", Ordering.Descending)
            .Get();

        return response.Models.Select(MapToTransaction).ToList();
    }

    public async Task<Transaction> Create(object createDto)
    {
        var client = _factory.CreateUserClient();
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(createDto);
        var row = Newtonsoft.Json.JsonConvert.DeserializeObject<TransactionRow>(json)
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TransactionCreateFailed, "Failed to map transaction");

        var response = await client.Table<TransactionRow>().Insert(row);
        return MapToTransaction(response.Models.FirstOrDefault()
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TransactionCreateFailed, "Failed to create transaction"));
    }

    public async Task<Transaction> Update(Guid id, object updateDto)
    {
        var client = _factory.CreateUserClient();
        var dict = updateDto as Dictionary<string, object?> ?? ToDictionary(updateDto);

        var table = client.Table<TransactionRow>().Filter("id", Operator.Equals, id.ToString());
        if (dict.TryGetValue("name", out var name)) table = table.Set(r => r.Name, name as string);
        if (dict.TryGetValue("amount", out var amount)) table = table.Set(r => r.Amount, amount as string);
        if (dict.TryGetValue("kind", out var kind) && kind is string kindStr)
            table = table.Set(r => r.Kind, Enum.Parse<Pulpe.Domain.Common.TransactionKind>(kindStr, true));
        if (dict.TryGetValue("transaction_date", out var txDate) && txDate is string txDateStr)
            table = table.Set(r => r.TransactionDate, DateTimeOffset.Parse(txDateStr));
        if (dict.TryGetValue("category", out var category)) table = table.Set(r => r.Category, category as string);
        if (dict.TryGetValue("checked_at", out var checkedAt))
            table = table.Set(r => r.CheckedAt, checkedAt is string s ? DateTimeOffset.Parse(s) : (DateTimeOffset?)null);
        if (dict.ContainsKey("original_amount"))
            table = table.Set(r => r.OriginalAmount, dict["original_amount"] as string);
        if (dict.ContainsKey("original_currency"))
            table = table.Set(r => r.OriginalCurrency, dict["original_currency"] as string);
        if (dict.ContainsKey("target_currency"))
            table = table.Set(r => r.TargetCurrency, dict["target_currency"] as string);
        if (dict.ContainsKey("exchange_rate"))
            table = table.Set(r => r.ExchangeRate, dict["exchange_rate"] as decimal?);

        var response = await table.Update();
        var row = response.Models.FirstOrDefault()
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TransactionUpdateFailed, "Failed to update transaction");

        return MapToTransaction(row);
    }

    public async Task Delete(Guid id)
    {
        var client = _factory.CreateUserClient();
        await client.Table<TransactionRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Delete();
    }

    public async Task<Transaction> ToggleCheck(Guid id)
    {
        var client = _factory.CreateUserClient();
        var response = await client.Rpc<TransactionRow>("toggle_budget_line_check",
            new Dictionary<string, object> { ["transaction_id"] = id.ToString() });

        if (response is not null)
            return MapToTransaction(response);

        // Fallback: direct toggle
        var current = await FindById(id)
            ?? throw new Domain.Common.BusinessException(ErrorCodes.TransactionNotFound, "Transaction not found", 404);

        var newCheckedAt = current.CheckedAt.HasValue ? (DateTimeOffset?)null : DateTimeOffset.UtcNow;
        var updated = await Update(id, new Dictionary<string, object?> { ["checked_at"] = newCheckedAt });
        return updated;
    }

    public async Task<(List<Transaction> Transactions, List<BudgetLine> BudgetLines)> Search(
        string query, string userId, int[]? years = null)
    {
        var client = _factory.CreateUserClient();
        var pattern = $"%{query}%";

        var transactionTask = client.Table<TransactionRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Filter("name", Operator.ILike, pattern)
            .Get();

        var budgetLineTask = client.Table<BudgetLineSearchRow>()
            .Filter("name", Operator.ILike, pattern)
            .Get();

        await Task.WhenAll(transactionTask, budgetLineTask);

        var transactions = transactionTask.Result.Models.Select(MapToTransaction).ToList();
        var budgetLines = budgetLineTask.Result.Models.Select(MapToBudgetLine).ToList();

        return (transactions, budgetLines);
    }

    private static Transaction MapToTransaction(TransactionRow row) => new()
    {
        Id = row.Id,
        BudgetId = row.BudgetId,
        BudgetLineId = row.BudgetLineId == Guid.Empty ? null : row.BudgetLineId,
        Name = row.Name ?? string.Empty,
        Amount = row.Amount ?? string.Empty,
        TransactionDate = row.TransactionDate,
        Category = row.Category,
        Kind = row.Kind,
        CheckedAt = row.CheckedAt,
        OriginalAmount = row.OriginalAmount,
        OriginalCurrency = row.OriginalCurrency,
        TargetCurrency = row.TargetCurrency,
        ExchangeRate = row.ExchangeRate,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static BudgetLine MapToBudgetLine(BudgetLineSearchRow row) => new()
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
        var json = Newtonsoft.Json.JsonConvert.SerializeObject(obj);
        return Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, object?>>(json) ?? [];
    }

    [Table("transaction")]
    private sealed class TransactionRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("budget_id")]
        public Guid BudgetId { get; set; }

        [Column("budget_line_id")]
        public Guid? BudgetLineId { get; set; }

        [Column("name")]
        public string? Name { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("transaction_date")]
        public DateTimeOffset TransactionDate { get; set; }

        [Column("category")]
        public string? Category { get; set; }

        [Column("kind")]
        public TransactionKind Kind { get; set; }

        [Column("checked_at")]
        public DateTimeOffset? CheckedAt { get; set; }

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

    [Table("budget_line")]
    private sealed class BudgetLineSearchRow : BaseModel
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
