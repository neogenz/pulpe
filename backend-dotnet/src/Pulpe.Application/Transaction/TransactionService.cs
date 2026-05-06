using Microsoft.Extensions.Logging;
using Pulpe.Application.Budget.Dto;
using Pulpe.Application.Common;
using Pulpe.Application.Currency;
using Pulpe.Application.Transaction.Dto;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Transaction;
using Pulpe.Domain.User;

namespace Pulpe.Application.Transaction;

public sealed class TransactionService : ITransactionService
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IBudgetRepository _budgetRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ICacheService _cacheService;
    private readonly IBudgetRecalculationService _budgetService;
    private readonly ICurrencyService _currencyService;
    private readonly ILogger<TransactionService> _logger;

    public TransactionService(
        ITransactionRepository transactionRepository,
        IBudgetRepository budgetRepository,
        IEncryptionService encryptionService,
        ICacheService cacheService,
        IBudgetRecalculationService budgetService,
        ICurrencyService currencyService,
        ILogger<TransactionService> logger)
    {
        _transactionRepository = transactionRepository;
        _budgetRepository = budgetRepository;
        _encryptionService = encryptionService;
        _cacheService = cacheService;
        _budgetService = budgetService;
        _currencyService = currencyService;
        _logger = logger;
    }

    public async Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user)
    {
        var transactions = await _transactionRepository.FindByBudgetId(budgetId);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return transactions.Select(t => MapToResponse(t, dek)).ToList();
    }

    public async Task<object> FindByBudgetLineAsync(Guid budgetLineId, AuthenticatedUser user)
    {
        var transactions = await _transactionRepository.FindByBudgetLineId(budgetLineId);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return transactions.Select(t => MapToResponse(t, dek)).ToList();
    }

    public async Task<object> SearchAsync(string q, int[]? years, AuthenticatedUser user)
    {
        var (transactions, budgetLines) = await _transactionRepository.Search(q, user.Id, years);

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

    public async Task<object> CreateAsync(object dto, AuthenticatedUser user)
    {
        var createDto = dto as TransactionCreateDto ?? throw new ArgumentException("Expected TransactionCreateDto");

        if (createDto.BudgetLineId.HasValue)
            await ValidateBudgetLineAllocation(createDto.BudgetLineId.Value, createDto.BudgetId, createDto.Kind);

        var fx = await _currencyService.ComputeOverride(createDto);
        var encryptedAmount = await _encryptionService.PrepareAmountData(createDto.Amount, user.Id, user.ClientKey);
        var encryptedOriginalAmount = fx.OriginalAmount.HasValue
            ? await _encryptionService.PrepareAmountData(fx.OriginalAmount.Value, user.Id, user.ClientKey)
            : (string?)null;

        var createData = new Dictionary<string, object?>
        {
            ["id"] = (createDto.Id ?? Guid.NewGuid()).ToString(),
            ["budget_id"] = createDto.BudgetId.ToString(),
            ["budget_line_id"] = createDto.BudgetLineId?.ToString(),
            ["name"] = createDto.Name,
            ["amount"] = encryptedAmount,
            ["kind"] = createDto.Kind,
            ["transaction_date"] = (createDto.TransactionDate ?? DateTimeOffset.UtcNow).ToString("O"),
            ["category"] = createDto.Category,
            ["checked_at"] = createDto.CheckedAt?.ToString("O"),
            ["original_amount"] = encryptedOriginalAmount,
            ["original_currency"] = fx.OriginalCurrency?.ToIsoCode(),
            ["target_currency"] = fx.TargetCurrency?.ToIsoCode(),
            ["exchange_rate"] = fx.ExchangeRate,
        };

        var created = await _transactionRepository.Create(createData);

        await _budgetService.RecalculateBalances(created.BudgetId, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(created, dek);
    }

    public async Task<object> FindOneAsync(Guid id, AuthenticatedUser user)
    {
        var transaction = await _transactionRepository.FindById(id)
            ?? throw BusinessException.NotFound(ErrorCodes.TransactionNotFound, $"Transaction '{id}' not found");

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(transaction, dek);
    }

    public async Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user)
    {
        var updateDto = dto as TransactionUpdateDto ?? throw new ArgumentException("Expected TransactionUpdateDto");

        var fx = await _currencyService.ComputeOverride(updateDto);

        string? encryptedAmount = null;
        if (updateDto.Amount.HasValue)
            encryptedAmount = await _encryptionService.PrepareAmountData(updateDto.Amount.Value, user.Id, user.ClientKey);

        string? encryptedOriginalAmount = null;
        if (fx.OriginalAmountChanged && fx.OriginalAmount.HasValue)
            encryptedOriginalAmount = await _encryptionService.PrepareAmountData(fx.OriginalAmount.Value, user.Id, user.ClientKey);

        var updateData = BuildUpdatePayload(updateDto, encryptedAmount, fx, encryptedOriginalAmount);

        var updated = await _transactionRepository.Update(id, updateData);

        await _budgetService.RecalculateBalances(updated.BudgetId, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(updated, dek);
    }

    public async Task<object> RemoveAsync(Guid id, AuthenticatedUser user)
    {
        var transaction = await _transactionRepository.FindById(id);
        var budgetId = transaction?.BudgetId;

        await _transactionRepository.Delete(id);

        if (budgetId.HasValue)
            await _budgetService.RecalculateBalances(budgetId.Value, user.ClientKey);

        await _cacheService.InvalidateForUser(user.Id);

        _logger.LogInformation("Transaction {TransactionId} deleted by user {UserId}", id, user.Id);
        return new { success = true };
    }

    public async Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user)
    {
        var updated = await _transactionRepository.ToggleCheck(id);
        await _cacheService.InvalidateForUser(user.Id);

        _logger.LogInformation("Transaction {TransactionId} check toggled by user {UserId}", id, user.Id);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToResponse(updated, dek);
    }

    private async Task ValidateBudgetLineAllocation(Guid budgetLineId, Guid budgetId, TransactionKind kind)
    {
        var lines = await _budgetRepository.FindLinesByBudgetId(budgetId);
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

    private static object BuildUpdatePayload(
        TransactionUpdateDto dto,
        string? encryptedAmount,
        FxOverrideResult fx,
        string? encryptedOriginalAmount)
    {
        var dict = new Dictionary<string, object?>();

        if (dto.Name is not null) dict["name"] = dto.Name;
        if (encryptedAmount is not null) dict["amount"] = encryptedAmount;
        if (dto.Kind.HasValue) dict["kind"] = dto.Kind.Value.ToString().ToLowerInvariant();
        if (dto.TransactionDate.HasValue) dict["transaction_date"] = dto.TransactionDate.Value.ToString("O");
        if (dto.Category is not null) dict["category"] = dto.Category;

        if (fx.OriginalAmountChanged) dict["original_amount"] = encryptedOriginalAmount;
        if (fx.OriginalCurrencyChanged) dict["original_currency"] = fx.OriginalCurrency?.ToIsoCode();
        if (fx.TargetCurrencyChanged) dict["target_currency"] = fx.TargetCurrency?.ToIsoCode();
        if (fx.ExchangeRateChanged) dict["exchange_rate"] = fx.ExchangeRate;

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
            UpdatedAt: t.UpdatedAt,
            OriginalAmount: t.OriginalAmount is not null
                ? _encryptionService.TryDecryptAmount(t.OriginalAmount, dek)
                : null,
            OriginalCurrency: CurrencyExtensions.FromIsoCode(t.OriginalCurrency),
            TargetCurrency: CurrencyExtensions.FromIsoCode(t.TargetCurrency),
            ExchangeRate: t.ExchangeRate
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
}
