using Microsoft.Extensions.Logging;
using Pulpe.Api.Domain.Budget;
using Pulpe.Api.Domain.Common;
using Pulpe.Api.Domain.Encryption;
using Pulpe.Api.Domain.Transaction;

namespace Pulpe.Api.Application.Budget;

public sealed class BudgetCalculator
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ILogger<BudgetCalculator> _logger;

    public BudgetCalculator(
        IBudgetRepository budgetRepository,
        ITransactionRepository transactionRepository,
        IEncryptionService encryptionService,
        ILogger<BudgetCalculator> logger)
    {
        _budgetRepository = budgetRepository;
        _transactionRepository = transactionRepository;
        _encryptionService = encryptionService;
        _logger = logger;
    }

    public async Task<decimal> CalculateEndingBalance(Guid budgetId, object supabaseClient, byte[] clientKey)
    {
        var userId = await FetchBudgetUserId(budgetId, supabaseClient);
        return await CalculateEndingBalanceInternal(budgetId, userId, supabaseClient, clientKey);
    }

    public async Task RecalculateAndPersist(Guid budgetId, object supabaseClient, byte[] clientKey)
    {
        var userId = await FetchBudgetUserId(budgetId, supabaseClient);
        var endingBalance = await CalculateEndingBalanceInternal(budgetId, userId, supabaseClient, clientKey);

        var dek = await _encryptionService.EnsureUserDek(userId, clientKey);
        var encryptedBalance = _encryptionService.EncryptAmount(endingBalance, dek);

        await _budgetRepository.UpdateEndingBalance(budgetId, encryptedBalance, supabaseClient);

        _logger.LogInformation("Balance recalculated and persisted for budget {BudgetId}", budgetId);
    }

    private async Task<decimal> CalculateEndingBalanceInternal(Guid budgetId, string userId, object supabaseClient, byte[] clientKey)
    {
        var budgetLines = await _budgetRepository.FindLinesByBudgetId(budgetId, supabaseClient);
        var transactions = await _transactionRepository.FindByBudgetId(budgetId, supabaseClient);

        var dek = await _encryptionService.GetUserDek(userId, clientKey);

        var decryptedLines = budgetLines.Select(line => new FinancialItemWithId(
            line.Id,
            line.Kind,
            _encryptionService.TryDecryptAmount(line.Amount, dek, 0m),
            line.CheckedAt
        )).ToList();

        var decryptedTransactions = transactions.Select(tx => new TransactionWithBudgetLineId(
            tx.BudgetLineId,
            tx.Kind,
            _encryptionService.TryDecryptAmount(tx.Amount, dek, 0m),
            tx.CheckedAt
        )).ToList();

        var metrics = BudgetFormulas.CalculateAllMetrics(decryptedLines, decryptedTransactions);
        return metrics.EndingBalance;
    }

    public async Task<RolloverResult> GetRollover(Guid budgetId, int payDayOfMonth, object supabaseClient, byte[] clientKey)
    {
        var userId = await FetchBudgetUserId(budgetId, supabaseClient);
        var allBudgets = await FetchAndDecryptBudgets(userId, supabaseClient, clientKey);

        if (allBudgets.Count == 0)
            return new RolloverResult(0m, 0m, 0m, null);

        return BudgetFormulas.CalculateRollover(allBudgets, budgetId, payDayOfMonth);
    }

    private async Task<string> FetchBudgetUserId(Guid budgetId, object supabaseClient)
    {
        var budget = await _budgetRepository.FindById(budgetId, supabaseClient);
        if (budget is null)
            throw BusinessException.NotFound(ErrorCodes.BudgetNotFound, $"Budget {budgetId} not found");

        return budget.UserId.ToString();
    }

    private async Task<List<(Guid Id, int Month, int Year, decimal? EndingBalance)>> FetchAndDecryptBudgets(
        string userId, object supabaseClient, byte[] clientKey)
    {
        var budgets = await _budgetRepository.FindAll(userId, supabaseClient);

        if (budgets.Count == 0)
            return [];

        var hasEncryptedData = budgets.Any(b => b.EndingBalance is not null);
        byte[]? dek = hasEncryptedData ? await _encryptionService.GetUserDek(userId, clientKey) : null;

        return budgets.Select(b => (
            b.Id,
            b.Month,
            b.Year,
            EndingBalance: (decimal?)(b.EndingBalance is not null && dek is not null
                ? _encryptionService.TryDecryptAmount(b.EndingBalance, dek, 0m)
                : 0m)
        )).ToList();
    }
}
