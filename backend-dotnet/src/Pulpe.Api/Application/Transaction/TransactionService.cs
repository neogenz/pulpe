using Microsoft.Extensions.Logging;
using Pulpe.Api.Application.Common;
using Pulpe.Api.Application.Transaction.Dto;
using Pulpe.Api.Domain.Budget;
using Pulpe.Api.Domain.Common;
using Pulpe.Api.Domain.Encryption;
using Pulpe.Api.Domain.Transaction;
using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.Transaction;

public sealed class TransactionService : ITransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IBudgetRepository _budgetRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ICacheService _cacheService;
    private readonly IBudgetRecalculationService _budgetService;
    private readonly ILogger<TransactionService> _logger;

    public TransactionService(
        ITransactionRepository transactionRepository,
        IBudgetRepository budgetRepository,
        IEncryptionService encryptionService,
        ICacheService cacheService,
        IBudgetRecalculationService budgetService,
        ILogger<TransactionService> logger)
    {
        _transactionRepository = transactionRepository;
        _budgetRepository = budgetRepository;
        _encryptionService = encryptionService;
        _cacheService = cacheService;
        _budgetService = budgetService;
        _logger = logger;
    }

    public async Task<List<TransactionResponseDto>> FindAll(AuthenticatedUser user, object supabase)
    {
        var (transactions, _) = await _transactionRepository.Search(string.Empty, user.Id, supabase);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return transactions.Select(t => MapToResponse(t, dek)).ToList();
    }

    public async Task<TransactionResponseDto> FindOne(Guid id, AuthenticatedUser user, object supabase)
    {
        var transaction = await _transactionRepository.FindById(id, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TransactionNotFound, $"Transaction '{id}' not found");

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(transaction, dek);
    }

    public async Task<TransactionResponseDto> Create(TransactionCreateDto dto, AuthenticatedUser user, object supabase)
    {
        if (dto.BudgetLineId.HasValue)
            await ValidateBudgetLineAllocation(dto.BudgetLineId.Value, dto.BudgetId, dto.Kind, supabase);

        var encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount, user.Id, user.ClientKey);

        var createData = new
        {
            budget_id = dto.BudgetId.ToString(),
            budget_line_id = dto.BudgetLineId?.ToString(),
            name = dto.Name,
            amount = encryptedAmount,
            kind = dto.Kind,
            transaction_date = (dto.TransactionDate ?? DateTimeOffset.UtcNow).ToString("O"),
            category = dto.Category,
        };

        var created = await _transactionRepository.Create(createData, supabase);

        await _budgetService.RecalculateBalances(created.BudgetId, supabase, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(created, dek);
    }

    public async Task<TransactionResponseDto> Update(Guid id, TransactionUpdateDto dto, AuthenticatedUser user, object supabase)
    {
        string? encryptedAmount = null;
        if (dto.Amount.HasValue)
            encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount.Value, user.Id, user.ClientKey);

        var updateData = BuildUpdatePayload(dto, encryptedAmount);

        var updated = await _transactionRepository.Update(id, updateData, supabase);

        await _budgetService.RecalculateBalances(updated.BudgetId, supabase, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(updated, dek);
    }

    public async Task Remove(Guid id, AuthenticatedUser user, object supabase)
    {
        var transaction = await _transactionRepository.FindById(id, supabase);
        var budgetId = transaction?.BudgetId;

        await _transactionRepository.Delete(id, supabase);

        if (budgetId.HasValue)
            await _budgetService.RecalculateBalances(budgetId.Value, supabase, user.ClientKey);

        await _cacheService.InvalidateForUser(user.Id);

        _logger.LogInformation("Transaction {TransactionId} deleted by user {UserId}", id, user.Id);
    }

    public async Task<List<TransactionResponseDto>> FindByBudgetId(Guid budgetId, AuthenticatedUser user, object supabase)
    {
        var transactions = await _transactionRepository.FindByBudgetId(budgetId, supabase);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return transactions.Select(t => MapToResponse(t, dek)).ToList();
    }

    public async Task<List<TransactionResponseDto>> FindByBudgetLineId(Guid budgetLineId, AuthenticatedUser user, object supabase)
    {
        var transactions = await _transactionRepository.FindByBudgetLineId(budgetLineId, supabase);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return transactions.Select(t => MapToResponse(t, dek)).ToList();
    }

    public async Task<TransactionResponseDto> ToggleCheck(Guid id, AuthenticatedUser user, object supabase)
    {
        var updated = await _transactionRepository.ToggleCheck(id, supabase);
        await _cacheService.InvalidateForUser(user.Id);

        _logger.LogInformation("Transaction {TransactionId} check toggled by user {UserId}", id, user.Id);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(updated, dek);
    }

    public async Task<List<TransactionSearchResultDto>> Search(
        string query, AuthenticatedUser user, object supabase, int[]? years = null)
    {
        var (transactions, budgetLines) = await _transactionRepository.Search(query, user.Id, supabase, years);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);

        var transactionResults = transactions
            .Take(Constants.SearchPerSourceLimit)
            .Select(t => new TransactionSearchResultDto(
                Id: t.Id,
                ItemType: "transaction",
                Name: t.Name,
                Amount: _encryptionService.TryDecryptAmount(t.Amount, dek),
                Kind: t.Kind,
                Recurrence: null,
                TransactionDate: t.TransactionDate,
                Category: t.Category,
                BudgetId: t.BudgetId,
                BudgetName: string.Empty,
                Year: t.TransactionDate.Year,
                Month: t.TransactionDate.Month,
                MonthLabel: GetMonthLabel(t.TransactionDate.Month)
            ))
            .ToList();

        var budgetLineResults = budgetLines
            .Take(Constants.SearchPerSourceLimit)
            .Select(bl => new TransactionSearchResultDto(
                Id: bl.Id,
                ItemType: "budget_line",
                Name: bl.Name,
                Amount: _encryptionService.TryDecryptAmount(bl.Amount, dek),
                Kind: bl.Kind,
                Recurrence: bl.Recurrence,
                TransactionDate: null,
                Category: null,
                BudgetId: bl.BudgetId,
                BudgetName: string.Empty,
                Year: DateTimeOffset.UtcNow.Year,
                Month: DateTimeOffset.UtcNow.Month,
                MonthLabel: GetMonthLabel(DateTimeOffset.UtcNow.Month)
            ))
            .ToList();

        return transactionResults
            .Concat(budgetLineResults)
            .OrderByDescending(r => r.Year)
            .ThenByDescending(r => r.Month)
            .Take(Constants.SearchResultLimit)
            .ToList();
    }

    private async Task ValidateBudgetLineAllocation(
        Guid budgetLineId, Guid budgetId, TransactionKind kind, object supabase)
    {
        // We validate via the budget repository's FindLinesByBudgetId
        var lines = await _budgetRepository.FindLinesByBudgetId(budgetId, supabase);
        var budgetLine = lines.FirstOrDefault(l => l.Id == budgetLineId);

        if (budgetLine is null)
            throw BusinessException.NotFound(
                ErrorCodes.BudgetLineNotFound,
                $"Budget line '{budgetLineId}' not found in budget '{budgetId}'");

        if (budgetLine.Kind != kind)
            throw BusinessException.BadRequest(
                ErrorCodes.TransactionKindMismatch,
                $"Transaction kind must match budget line kind (expected: {budgetLine.Kind}, got: {kind})");
    }

    private static object BuildUpdatePayload(TransactionUpdateDto dto, string? encryptedAmount)
    {
        var dict = new Dictionary<string, object?>();

        if (dto.Name is not null) dict["name"] = dto.Name;
        if (encryptedAmount is not null) dict["amount"] = encryptedAmount;
        if (dto.Kind.HasValue) dict["kind"] = dto.Kind.Value.ToString().ToLowerInvariant();
        if (dto.TransactionDate.HasValue) dict["transaction_date"] = dto.TransactionDate.Value.ToString("O");
        if (dto.Category is not null) dict["category"] = dto.Category;
        dict["updated_at"] = DateTimeOffset.UtcNow.ToString("O");

        return dict;
    }

    private TransactionResponseDto MapToResponse(Domain.Transaction.Transaction t, byte[] dek) =>
        new(
            Id: t.Id,
            BudgetId: t.BudgetId,
            BudgetLineId: t.BudgetLineId,
            Name: t.Name,
            Amount: _encryptionService.TryDecryptAmount(t.Amount, dek),
            TransactionDate: t.TransactionDate,
            Category: t.Category,
            Kind: t.Kind,
            CheckedAt: t.CheckedAt,
            CreatedAt: t.CreatedAt,
            UpdatedAt: t.UpdatedAt
        );

    private static string GetMonthLabel(int month) => month switch
    {
        1 => "Janvier",
        2 => "Février",
        3 => "Mars",
        4 => "Avril",
        5 => "Mai",
        6 => "Juin",
        7 => "Juillet",
        8 => "Août",
        9 => "Septembre",
        10 => "Octobre",
        11 => "Novembre",
        12 => "Décembre",
        _ => string.Empty
    };

    // ITransactionService bridge methods
    public async Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindByBudgetId(budgetId, user, supabase);

    public async Task<object> FindByBudgetLineAsync(Guid budgetLineId, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindByBudgetLineId(budgetLineId, user, supabase);

    public async Task<object> SearchAsync(string q, int[]? years, AuthenticatedUser user, SupabaseRestClient supabase)
        => await Search(q, user, supabase, years);

    public async Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var createDto = dto as TransactionCreateDto ?? throw new ArgumentException("Expected TransactionCreateDto");
        return await Create(createDto, user, supabase);
    }

    public async Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindOne(id, user, supabase);

    public async Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var updateDto = dto as TransactionUpdateDto ?? throw new ArgumentException("Expected TransactionUpdateDto");
        return await Update(id, updateDto, user, supabase);
    }

    public async Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        await Remove(id, user, supabase);
        return new { success = true };
    }

    public async Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await ToggleCheck(id, user, supabase);
}
