using Microsoft.Extensions.Logging;
using Pulpe.Application.Budget.Dto;
using Pulpe.Application.Common;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Transaction;
using Pulpe.Domain.User;

namespace Pulpe.Application.Budget;

public sealed class BudgetService : IBudgetService, Application.Common.IBudgetRecalculationService
{
    private static readonly HashSet<string> AllowedSparseFields =
    [
        "month", "year", "totalExpenses", "totalSavings", "totalIncome", "remaining", "rollover"
    ];

    private readonly BudgetCalculator _calculator;
    private readonly BudgetValidator _validator;
    private readonly IBudgetRepository _repository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ICacheService _cacheService;
    private readonly IUserMetadataService _userMetadataService;
    private readonly ILogger<BudgetService> _logger;

    public BudgetService(
        BudgetCalculator calculator,
        BudgetValidator validator,
        IBudgetRepository repository,
        ITransactionRepository transactionRepository,
        IEncryptionService encryptionService,
        ICacheService cacheService,
        IUserMetadataService userMetadataService,
        ILogger<BudgetService> logger)
    {
        _calculator = calculator;
        _validator = validator;
        _repository = repository;
        _transactionRepository = transactionRepository;
        _encryptionService = encryptionService;
        _cacheService = cacheService;
        _userMetadataService = userMetadataService;
        _logger = logger;
    }

    // IBudgetService (Application/Budget/)
    public async Task<object> FindAllAsync(AuthenticatedUser user, object? query = null)
    {
        var queryDto = query as ListBudgetsQueryDto;
        if (queryDto?.Fields is not null)
            return await FindAllSparse(user, queryDto);
        return await FindAll(user, queryDto);
    }

    public async Task<object> CreateAsync(object dto, AuthenticatedUser user)
    {
        var createDto = dto as BudgetCreateDto ?? throw new ArgumentException("Expected BudgetCreateDto");
        return await Create(createDto, user);
    }

    public async Task<object> ExportAllAsync(AuthenticatedUser user)
        => await ExportAll(user);

    public async Task<bool> HasBudgetsAsync(AuthenticatedUser user)
        => await HasBudgets(user);

    public async Task<object> FindOneAsync(Guid id, AuthenticatedUser user)
        => await FindOne(id, user);

    public async Task<object> FindOneWithDetailsAsync(Guid id, AuthenticatedUser user)
        => await FindOneWithDetails(id, user);

    public async Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user)
    {
        var updateDto = dto as BudgetUpdateDto ?? throw new ArgumentException("Expected BudgetUpdateDto");
        return await Update(id, updateDto, user);
    }

    public async Task<object> RemoveAsync(Guid id, AuthenticatedUser user)
        => await Remove(id, user);

    // Application.Common.IBudgetRecalculationService
    public async Task RecalculateBalances(Guid budgetId, byte[] clientKey)
        => await _calculator.RecalculateAndPersist(budgetId, clientKey);

    // Typed public methods
    public async Task<bool> HasBudgets(AuthenticatedUser user)
        => await _repository.HasBudgets(user.Id);

    public async Task<ApiListResponse<BudgetResponseDto>> FindAll(
        AuthenticatedUser user, ListBudgetsQueryDto? query = null)
    {
        var keyParts = string.Join(":",
            Convert.ToHexString(user.ClientKey).ToLower()[..16],
            query?.Fields ?? string.Empty,
            query?.Limit?.ToString() ?? string.Empty,
            query?.Year?.ToString() ?? string.Empty);
        var cacheKey = $"budgets:list:{keyParts}";

        return await _cacheService.GetOrSet(user.Id, cacheKey,
            TimeSpan.FromSeconds(Constants.DefaultCacheTtlSeconds),
            () => FetchBudgetList(user, query));
    }

    public async Task<ApiListResponse<BudgetSparseDto>> FindAllSparse(
        AuthenticatedUser user, ListBudgetsQueryDto query)
    {
        var requestedFields = query.Fields!.Split(',').Select(f => f.Trim()).ToList();
        var invalidFields = requestedFields.Where(f => !AllowedSparseFields.Contains(f)).ToList();

        if (invalidFields.Count > 0)
            throw BusinessException.BadRequest(ErrorCodes.BudgetUnknownSparseFields,
                $"Unknown sparse fields: {string.Join(", ", invalidFields)}");

        var budgets = await FetchBudgetsWithFilters(user.Id, query);
        var needsAggregates = FieldsRequireAggregates(requestedFields);
        var needsRollover = FieldsRequireRollover(requestedFields);
        var payDayOfMonth = await _userMetadataService.GetPayDayOfMonth(user.AccessToken);

        var sparseResults = await Task.WhenAll(budgets.Select(async budget =>
        {
            decimal? totalExpenses = null;
            decimal? totalSavings = null;
            decimal? totalIncome = null;
            decimal? remaining = null;
            decimal? rollover = null;

            if (needsAggregates)
            {
                var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
                var lines = await _repository.FindLinesByBudgetId(budget.Id);
                var transactions = await _transactionRepository.FindByBudgetId(budget.Id);

                var decryptedLines = lines.Select(l => new FinancialItemWithId(
                    l.Id, l.Kind, _encryptionService.TryDecryptAmount(l.Amount, dek, 0m), l.CheckedAt)).ToList();
                var decryptedTxs = transactions.Select(tx => new TransactionWithBudgetLineId(
                    tx.BudgetLineId, tx.Kind, _encryptionService.TryDecryptAmount(tx.Amount, dek, 0m), tx.CheckedAt)).ToList();

                var metrics = BudgetFormulas.CalculateAllMetrics(decryptedLines, decryptedTxs);
                totalExpenses = metrics.TotalExpenses;
                totalSavings = metrics.TotalSavings;
                totalIncome = metrics.TotalIncome;
                remaining = metrics.Remaining;
            }

            if (needsRollover)
            {
                try
                {
                    var rolloverResult = await _calculator.GetRollover(budget.Id, payDayOfMonth, user.ClientKey);
                    rollover = rolloverResult.Rollover;
                    if (needsAggregates && remaining.HasValue)
                        remaining = remaining.Value + rollover.Value;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to fetch rollover for budget {BudgetId}", budget.Id);
                    rollover = 0m;
                }
            }

            return new BudgetSparseDto(
                budget.Id,
                requestedFields.Contains("month") ? budget.Month : null,
                requestedFields.Contains("year") ? budget.Year : null,
                requestedFields.Contains("totalExpenses") ? totalExpenses : null,
                requestedFields.Contains("totalSavings") ? totalSavings : null,
                requestedFields.Contains("totalIncome") ? totalIncome : null,
                requestedFields.Contains("remaining") ? remaining : null,
                requestedFields.Contains("rollover") ? rollover : null
            );
        }));

        return new ApiListResponse<BudgetSparseDto>(true, [.. sparseResults]);
    }

    public async Task<ApiResponse<BudgetExportDataDto>> ExportAll(AuthenticatedUser user)
    {
        var startTime = DateTimeOffset.UtcNow;
        var payDayOfMonth = await _userMetadataService.GetPayDayOfMonth(user.AccessToken);
        var budgets = await _repository.FindAll(user.Id);
        var orderedBudgets = budgets.OrderBy(b => b.Year).ThenBy(b => b.Month).ToList();

        var budgetsWithDetails = await Task.WhenAll(orderedBudgets.Select(budget =>
            EnrichBudgetForExport(budget, user, payDayOfMonth)));

        _logger.LogInformation("Exported {Count} budgets for user {UserId} in {Duration}ms",
            budgetsWithDetails.Length, user.Id, (DateTimeOffset.UtcNow - startTime).TotalMilliseconds);

        var exportData = new BudgetExportDataDto(
            DateTimeOffset.UtcNow.ToString("O"),
            budgetsWithDetails.Length,
            [.. budgetsWithDetails]);

        return new ApiResponse<BudgetExportDataDto>(true, exportData);
    }

    public async Task<ApiResponse<BudgetResponseDto>> Create(
        BudgetCreateDto dto, AuthenticatedUser user)
    {
        _validator.ValidateBudgetInput(dto);
        await _validator.ValidateNoDuplicatePeriod(_repository, user.Id, dto.Month, dto.Year);

        var rpcArgs = new
        {
            p_user_id = user.Id,
            p_template_id = dto.TemplateId.ToString(),
            p_month = dto.Month,
            p_year = dto.Year,
            p_description = dto.Description ?? string.Empty
        };

        var budget = await _repository.Create(rpcArgs);
        await _calculator.RecalculateAndPersist(budget.Id, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        _logger.LogInformation("Budget created {BudgetId} for user {UserId} period {Month}/{Year}",
            budget.Id, user.Id, dto.Month, dto.Year);

        return new ApiResponse<BudgetResponseDto>(true, MapToResponseDto(budget));
    }

    public async Task<ApiResponse<BudgetResponseDto>> FindOne(Guid id, AuthenticatedUser user)
    {
        var budget = await _repository.FindById(id);
        if (budget is null)
            throw BusinessException.NotFound(ErrorCodes.BudgetNotFound, $"Budget {id} not found");

        return new ApiResponse<BudgetResponseDto>(true, MapToResponseDto(budget));
    }

    public async Task<ApiResponse<BudgetDetailsResponseDto>> FindOneWithDetails(
        Guid id, AuthenticatedUser user)
    {
        var clientKeyHex = Convert.ToHexString(user.ClientKey).ToLower()[..16];
        var cacheKey = $"budgets:detail:{clientKeyHex}:{id}";

        return await _cacheService.GetOrSet(user.Id, cacheKey,
            TimeSpan.FromSeconds(Constants.DefaultCacheTtlSeconds),
            () => FetchBudgetWithDetails(id, user));
    }

    public async Task<ApiResponse<BudgetResponseDto>> Update(
        Guid id, BudgetUpdateDto dto, AuthenticatedUser user)
    {
        _validator.ValidateUpdateBudgetDto(dto);

        if (dto.Month.HasValue && dto.Year.HasValue)
            await _validator.ValidateNoDuplicatePeriod(_repository, user.Id, dto.Month.Value, dto.Year.Value, id);

        var updatePayload = new Dictionary<string, object?>();
        if (dto.Description is not null) updatePayload["description"] = dto.Description;
        if (dto.Month.HasValue) updatePayload["month"] = dto.Month.Value;
        if (dto.Year.HasValue) updatePayload["year"] = dto.Year.Value;

        var budget = await _repository.Update(id, updatePayload);
        await _calculator.RecalculateAndPersist(id, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetResponseDto>(true, MapToResponseDto(budget));
    }

    public async Task<ApiResponse<string>> Remove(Guid id, AuthenticatedUser user)
    {
        await _repository.Delete(id);
        await _cacheService.InvalidateForUser(user.Id);
        return new ApiResponse<string>(true, "Budget deleted successfully");
    }

    private async Task<ApiListResponse<BudgetResponseDto>> FetchBudgetList(
        AuthenticatedUser user, ListBudgetsQueryDto? query)
    {
        var budgets = await FetchBudgetsWithFilters(user.Id, query);
        var payDayOfMonth = await _userMetadataService.GetPayDayOfMonth(user.AccessToken);

        var enrichedBudgets = await Task.WhenAll(budgets.Select(async budget =>
        {
            try
            {
                var remaining = await CalculateRemainingForBudget(budget, payDayOfMonth, user.ClientKey);
                var decryptedBalance = await DecryptEndingBalance(budget, user.ClientKey);
                return MapToResponseDto(budget, remaining: remaining, endingBalance: decryptedBalance);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to calculate remaining for budget {BudgetId}", budget.Id);
                var fallbackBalance = await DecryptEndingBalance(budget, user.ClientKey);
                return MapToResponseDto(budget, remaining: fallbackBalance, endingBalance: fallbackBalance);
            }
        }));

        return new ApiListResponse<BudgetResponseDto>(true, [.. enrichedBudgets]);
    }

    private async Task<List<Domain.Budget.Budget>> FetchBudgetsWithFilters(
        string userId, ListBudgetsQueryDto? query)
    {
        var budgets = await _repository.FindAll(userId);

        if (query?.Year.HasValue == true)
            budgets = budgets.Where(b => b.Year == query.Year.Value).ToList();

        if (query?.Limit.HasValue == true)
            budgets = budgets.Take(query.Limit.Value).ToList();

        return budgets;
    }

    private async Task<ApiResponse<BudgetDetailsResponseDto>> FetchBudgetWithDetails(
        Guid id, AuthenticatedUser user)
    {
        var budget = await _repository.FindById(id);
        if (budget is null)
            throw BusinessException.NotFound(ErrorCodes.BudgetNotFound, $"Budget {id} not found");

        var payDayOfMonth = await _userMetadataService.GetPayDayOfMonth(user.AccessToken);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var budgetLines = await _repository.FindLinesByBudgetId(id);
        var transactions = await _transactionRepository.FindByBudgetId(id);
        var rolloverResult = await _calculator.GetRollover(id, payDayOfMonth, user.ClientKey);

        var decryptedBalance = budget.EndingBalance is not null
            ? _encryptionService.TryDecryptAmount(budget.EndingBalance, dek, 0m)
            : (decimal?)null;

        var budgetDto = MapToResponseDto(budget,
            rollover: rolloverResult.Rollover,
            previousBudgetId: rolloverResult.PreviousBudgetId,
            endingBalance: decryptedBalance);

        var linesDtos = budgetLines.Select(line => new BudgetLineResponseDto(
            line.Id, line.BudgetId, line.TemplateLineId, line.SavingsGoalId, line.Name,
            _encryptionService.TryDecryptAmount(line.Amount, dek, 0m),
            line.Recurrence, line.Kind,
            line.IsManuallyAdjusted, line.CheckedAt, line.CreatedAt, line.UpdatedAt)).ToList();

        var txDtos = transactions.Select(tx => new TransactionResponseDto(
            tx.Id, tx.BudgetId, tx.BudgetLineId, tx.Name,
            _encryptionService.TryDecryptAmount(tx.Amount, dek, 0m),
            tx.TransactionDate, tx.Category, tx.Kind,
            tx.CheckedAt, tx.CreatedAt, tx.UpdatedAt)).ToList();

        _logger.LogInformation("Budget details fetched for {BudgetId}: {LineCount} lines, {TxCount} transactions",
            id, linesDtos.Count, txDtos.Count);

        var details = new BudgetDetailsResponseDto(budgetDto, linesDtos, txDtos);
        return new ApiResponse<BudgetDetailsResponseDto>(true, details);
    }

    private async Task<BudgetWithDetailsDto> EnrichBudgetForExport(
        Domain.Budget.Budget budget, AuthenticatedUser user, int payDayOfMonth)
    {
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var budgetLines = await _repository.FindLinesByBudgetId(budget.Id);
        var transactions = await _transactionRepository.FindByBudgetId(budget.Id);
        var rolloverResult = await _calculator.GetRollover(budget.Id, payDayOfMonth, user.ClientKey);
        var remaining = await CalculateRemainingForBudget(budget, payDayOfMonth, user.ClientKey);

        var decryptedBalance = budget.EndingBalance is not null
            ? _encryptionService.TryDecryptAmount(budget.EndingBalance, dek, 0m)
            : (decimal?)null;

        var linesDtos = budgetLines.Select(line => new BudgetLineResponseDto(
            line.Id, line.BudgetId, line.TemplateLineId, line.SavingsGoalId, line.Name,
            _encryptionService.TryDecryptAmount(line.Amount, dek, 0m),
            line.Recurrence, line.Kind,
            line.IsManuallyAdjusted, line.CheckedAt, line.CreatedAt, line.UpdatedAt)).ToList();

        var txDtos = transactions.Select(tx => new TransactionResponseDto(
            tx.Id, tx.BudgetId, tx.BudgetLineId, tx.Name,
            _encryptionService.TryDecryptAmount(tx.Amount, dek, 0m),
            tx.TransactionDate, tx.Category, tx.Kind,
            tx.CheckedAt, tx.CreatedAt, tx.UpdatedAt)).ToList();

        return new BudgetWithDetailsDto(
            budget.Id, budget.Month, budget.Year, budget.Description,
            decryptedBalance, budget.TemplateId, budget.UserId,
            rolloverResult.Rollover, remaining,
            rolloverResult.PreviousBudgetId,
            budget.CreatedAt, budget.UpdatedAt,
            linesDtos, txDtos);
    }

    private async Task<decimal> CalculateRemainingForBudget(
        Domain.Budget.Budget budget, int payDayOfMonth, byte[] clientKey)
    {
        try
        {
            var currentBalance = await _calculator.CalculateEndingBalance(budget.Id, clientKey);
            var rolloverResult = await _calculator.GetRollover(budget.Id, payDayOfMonth, clientKey);
            return currentBalance + rolloverResult.Rollover;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to calculate dynamic remaining for budget {BudgetId}", budget.Id);
            var rolloverResult = await _calculator.GetRollover(budget.Id, payDayOfMonth, clientKey);
            var storedBalance = await DecryptEndingBalance(budget, clientKey);
            return storedBalance + rolloverResult.Rollover;
        }
    }

    private async Task<decimal> DecryptEndingBalance(Domain.Budget.Budget budget, byte[] clientKey)
    {
        if (budget.EndingBalance is null) return 0m;
        var dek = await _encryptionService.GetUserDek(budget.UserId.ToString(), clientKey);
        return _encryptionService.TryDecryptAmount(budget.EndingBalance, dek, 0m);
    }

    private static bool FieldsRequireAggregates(List<string> fields) =>
        fields.Any(f => f is "totalExpenses" or "totalSavings" or "totalIncome" or "remaining");

    private static bool FieldsRequireRollover(List<string> fields) =>
        fields.Contains("rollover") || fields.Contains("remaining");

    private static BudgetResponseDto MapToResponseDto(
        Domain.Budget.Budget budget,
        decimal? rollover = null,
        decimal? remaining = null,
        decimal? endingBalance = null,
        Guid? previousBudgetId = null) =>
        new(
            budget.Id, budget.Month, budget.Year, budget.Description,
            endingBalance, budget.TemplateId, budget.UserId,
            rollover, remaining, previousBudgetId,
            budget.CreatedAt, budget.UpdatedAt
        );
}
