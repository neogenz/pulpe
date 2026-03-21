using Pulpe.Api.Domain.Budget;
using Pulpe.Api.Domain.Common;
using Pulpe.Api.Domain.Transaction;

namespace Pulpe.Api.Infrastructure.Supabase.Repositories;

public sealed class TransactionRepository : ITransactionRepository
{
    private readonly SupabaseClientFactory _factory;

    public TransactionRepository(SupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<Transaction?> FindById(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("transaction")
            .Select("*")
            .Eq("id", id.ToString())
            .Single();

        var response = await client.Execute<TransactionRow>(builder);
        return response.Data is null ? null : MapToTransaction(response.Data);
    }

    public async Task<List<Transaction>> FindByBudgetId(Guid budgetId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("transaction")
            .Select("*")
            .Eq("budget_id", budgetId.ToString())
            .Order("transaction_date", ascending: false);

        var response = await client.Execute<List<TransactionRow>>(builder);
        return response.Data?.Select(MapToTransaction).ToList() ?? [];
    }

    public async Task<List<Transaction>> FindByBudgetLineId(Guid budgetLineId, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("transaction")
            .Select("*")
            .Eq("budget_line_id", budgetLineId.ToString())
            .Order("transaction_date", ascending: false);

        var response = await client.Execute<List<TransactionRow>>(builder);
        return response.Data?.Select(MapToTransaction).ToList() ?? [];
    }

    public async Task<Transaction> Create(object createDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("transaction").Insert(createDto);

        var response = await client.Execute<List<TransactionRow>>(builder);
        var row = response.Data?.FirstOrDefault();
        if (!response.IsSuccess || row is null)
            throw new Domain.Common.BusinessException(ErrorCodes.TransactionCreateFailed, response.Error?.Message ?? "Failed to create transaction");

        return MapToTransaction(row);
    }

    public async Task<Transaction> Update(Guid id, object updateDto, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("transaction")
            .Eq("id", id.ToString())
            .Update(updateDto);

        var response = await client.Execute<List<TransactionRow>>(builder);
        var row = response.Data?.FirstOrDefault();
        if (!response.IsSuccess || row is null)
            throw new Domain.Common.BusinessException(ErrorCodes.TransactionUpdateFailed, response.Error?.Message ?? "Failed to update transaction");

        return MapToTransaction(row);
    }

    public async Task Delete(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var builder = client.From("transaction")
            .Eq("id", id.ToString())
            .Delete();

        var response = await client.Execute<object>(builder);
        if (!response.IsSuccess)
            throw new Domain.Common.BusinessException(ErrorCodes.TransactionDeleteFailed, response.Error?.Message ?? "Failed to delete transaction");
    }

    public async Task<Transaction> ToggleCheck(Guid id, object supabaseClient)
    {
        var client = CastClient(supabaseClient);
        var response = await client.Rpc<TransactionRow>("toggle_budget_line_check", new { transaction_id = id.ToString() });

        if (!response.IsSuccess || response.Data is null)
        {
            // Fallback: direct toggle
            var current = await FindById(id, supabaseClient);
            if (current is null)
                throw new Domain.Common.BusinessException(ErrorCodes.TransactionNotFound, "Transaction not found", 404);

            var newCheckedAt = current.CheckedAt.HasValue ? (DateTimeOffset?)null : DateTimeOffset.UtcNow;
            var updateBuilder = client.From("transaction")
                .Eq("id", id.ToString())
                .Update(new { checked_at = newCheckedAt });

            var updateResponse = await client.Execute<List<TransactionRow>>(updateBuilder);
            var updatedRow = updateResponse.Data?.FirstOrDefault();
            if (!updateResponse.IsSuccess || updatedRow is null)
                throw new Domain.Common.BusinessException(ErrorCodes.TransactionUpdateFailed, "Failed to toggle transaction check");

            return MapToTransaction(updatedRow);
        }

        return MapToTransaction(response.Data);
    }

    public async Task<(List<Transaction> Transactions, List<BudgetLine> BudgetLines)> Search(
        string query, string userId, object supabaseClient, int[]? years = null)
    {
        var client = CastClient(supabaseClient);
        var pattern = $"%{query}%";

        // Run parallel searches on transaction and budget_line tables
        var transactionTask = client.Execute<List<TransactionRow>>(
            client.From("transaction")
                .Select("*")
                .Eq("user_id", userId)
                .ILike("name", pattern));

        var budgetLineTask = client.Execute<List<BudgetLineSearchRow>>(
            client.From("budget_line")
                .Select("*")
                .ILike("name", pattern));

        await Task.WhenAll(transactionTask, budgetLineTask);

        var transactions = (await transactionTask).Data?.Select(MapToTransaction).ToList() ?? [];
        var budgetLines = (await budgetLineTask).Data?.Select(MapToBudgetLine).ToList() ?? [];

        return (transactions, budgetLines);
    }

    private static SupabaseRestClient CastClient(object supabaseClient) =>
        supabaseClient as SupabaseRestClient
            ?? throw new ArgumentException("Expected SupabaseRestClient", nameof(supabaseClient));

    private static Transaction MapToTransaction(TransactionRow row) => new()
    {
        Id = Guid.Parse(row.Id),
        BudgetId = Guid.Parse(row.BudgetId),
        BudgetLineId = row.BudgetLineId is not null ? Guid.Parse(row.BudgetLineId) : null,
        Name = row.Name ?? string.Empty,
        Amount = row.Amount ?? string.Empty,
        TransactionDate = row.TransactionDate,
        Category = row.Category,
        Kind = row.Kind,
        CheckedAt = row.CheckedAt,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private static BudgetLine MapToBudgetLine(BudgetLineSearchRow row) => new()
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

    private sealed class TransactionRow
    {
        public string Id { get; set; } = string.Empty;
        public string BudgetId { get; set; } = string.Empty;
        public string? BudgetLineId { get; set; }
        public string? Name { get; set; }
        public string? Amount { get; set; }
        public DateTimeOffset TransactionDate { get; set; }
        public string? Category { get; set; }
        public TransactionKind Kind { get; set; }
        public DateTimeOffset? CheckedAt { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }

    private sealed class BudgetLineSearchRow
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
}
