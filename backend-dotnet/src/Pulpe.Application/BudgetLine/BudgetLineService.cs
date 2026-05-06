using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Pulpe.Application.BudgetLine.Dto;
using Pulpe.Application.Budget.Dto;
using Pulpe.Application.Common;
using Pulpe.Application.Currency;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Transaction;
using Pulpe.Domain.User;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;

namespace Pulpe.Application.BudgetLine;

public sealed class BudgetLineService : IBudgetLineService
{
    private readonly IBudgetRecalculationService _budgetService;
    private readonly IEncryptionService _encryptionService;
    private readonly ICacheService _cacheService;
    private readonly IBudgetRepository _budgetRepository;
    private readonly ISupabaseClientFactory _clientFactory;
    private readonly ICurrencyService _currencyService;
    private readonly ILogger<BudgetLineService> _logger;

    public BudgetLineService(
        IBudgetRecalculationService budgetService,
        IEncryptionService encryptionService,
        ICacheService cacheService,
        IBudgetRepository budgetRepository,
        ISupabaseClientFactory clientFactory,
        ICurrencyService currencyService,
        ILogger<BudgetLineService> logger)
    {
        _budgetService = budgetService;
        _encryptionService = encryptionService;
        _cacheService = cacheService;
        _budgetRepository = budgetRepository;
        _clientFactory = clientFactory;
        _currencyService = currencyService;
        _logger = logger;
    }

    public async Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user)
    {
        var lines = await _budgetRepository.FindLinesByBudgetId(budgetId);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);

        var lineDtos = lines.Select(line => MapToResponseDto(line, dek)).ToList();
        return new ApiListResponse<BudgetLineResponseDto>(true, lineDtos);
    }

    public async Task<object> CreateAsync(object dto, AuthenticatedUser user)
    {
        var createDto = dto as BudgetLineCreateDto ?? throw new ArgumentException("Expected BudgetLineCreateDto");
        return await Create(createDto, user);
    }

    public async Task<object> FindOneAsync(Guid id, AuthenticatedUser user)
        => await FindOne(id, user);

    public async Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user)
    {
        var updateDto = dto as BudgetLineUpdateDto ?? throw new ArgumentException("Expected BudgetLineUpdateDto");
        return await Update(id, updateDto, user);
    }

    public async Task<object> ResetFromTemplateAsync(Guid id, AuthenticatedUser user)
        => await ResetFromTemplate(id, user);

    public async Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user)
        => await ToggleCheck(id, user);

    public async Task<object> CheckTransactionsAsync(Guid id, AuthenticatedUser user)
        => await CheckTransactions(id, user);

    public async Task<object> RemoveAsync(Guid id, AuthenticatedUser user)
        => await Remove(id, user);

    private async Task<ApiResponse<BudgetLineResponseDto>> Create(BudgetLineCreateDto dto, AuthenticatedUser user)
    {
        ValidateCreateDto(dto);

        var fx = await _currencyService.ComputeOverride(dto);
        var encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount, user.Id, user.ClientKey);
        var encryptedOriginalAmount = fx.OriginalAmount.HasValue
            ? await _encryptionService.PrepareAmountData(fx.OriginalAmount.Value, user.Id, user.ClientKey)
            : null;

        var client = _clientFactory.CreateUserClient();
        var row = await client.Table<BudgetLineRow>()
            .Insert(new BudgetLineRow
            {
                Id = dto.Id ?? Guid.NewGuid(),
                BudgetId = dto.BudgetId,
                Name = dto.Name,
                Amount = encryptedAmount,
                Kind = dto.Kind,
                Recurrence = dto.Recurrence,
                IsManuallyAdjusted = dto.IsManuallyAdjusted,
                TemplateLineId = dto.TemplateLineId,
                SavingsGoalId = dto.SavingsGoalId,
                CheckedAt = dto.CheckedAt,
                OriginalAmount = encryptedOriginalAmount,
                OriginalCurrency = fx.OriginalCurrency?.ToIsoCode(),
                TargetCurrency = fx.TargetCurrency?.ToIsoCode(),
                ExchangeRate = fx.ExchangeRate
            });

        var inserted = row.Models.FirstOrDefault()
            ?? throw new BusinessException(ErrorCodes.BudgetLineCreateFailed, "Failed to create budget line");

        var line = MapRowToDomainLine(inserted);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineDto = MapToResponseDto(line, dek);

        await _budgetService.RecalculateBalances(dto.BudgetId, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> FindOne(Guid id, AuthenticatedUser user)
    {
        var line = await FetchBudgetLineById(id);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return new ApiResponse<BudgetLineResponseDto>(true, MapToResponseDto(line, dek));
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> Update(Guid id, BudgetLineUpdateDto dto, AuthenticatedUser user)
    {
        ValidateUpdateDto(dto);

        var fx = await _currencyService.ComputeOverride(dto);
        var client = _clientFactory.CreateUserClient();
        var table = client.Table<BudgetLineRow>().Filter("id", Operator.Equals, id.ToString());

        if (dto.Name is not null) table = table.Set(r => r.Name, dto.Name);
        if (dto.Kind.HasValue) table = table.Set(r => r.Kind, dto.Kind.Value.ToString().ToLowerInvariant());
        if (dto.Recurrence.HasValue) table = table.Set(r => r.Recurrence, dto.Recurrence.Value.ToString().ToLowerInvariant());

        if (dto.Amount.HasValue)
        {
            var encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount.Value, user.Id, user.ClientKey);
            table = table.Set(r => r.Amount, encryptedAmount);
        }

        if (fx.OriginalAmountChanged)
        {
            var encOriginal = fx.OriginalAmount.HasValue
                ? await _encryptionService.PrepareAmountData(fx.OriginalAmount.Value, user.Id, user.ClientKey)
                : null;
            table = table.Set(r => r.OriginalAmount, encOriginal);
        }
        if (fx.OriginalCurrencyChanged)
            table = table.Set(r => r.OriginalCurrency, fx.OriginalCurrency?.ToIsoCode());
        if (fx.TargetCurrencyChanged)
            table = table.Set(r => r.TargetCurrency, fx.TargetCurrency?.ToIsoCode());
        if (fx.ExchangeRateChanged)
            table = table.Set(r => r.ExchangeRate, fx.ExchangeRate);

        var response = await table.Update();

        var row = response.Models.FirstOrDefault()
            ?? throw BusinessException.NotFound(ErrorCodes.BudgetLineNotFound, $"Budget line {id} not found");

        var line = MapRowToDomainLine(row);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineDto = MapToResponseDto(line, dek);

        await _budgetService.RecalculateBalances(line.BudgetId, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<string>> Remove(Guid id, AuthenticatedUser user)
    {
        Guid? budgetId = null;
        try
        {
            var line = await FetchBudgetLineById(id);
            budgetId = line.BudgetId;
        }
        catch { }

        var client = _clientFactory.CreateUserClient();
        await client.Table<BudgetLineRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Delete();

        if (budgetId.HasValue)
            await _budgetService.RecalculateBalances(budgetId.Value, user.ClientKey);

        await _cacheService.InvalidateForUser(user.Id);
        return new ApiResponse<string>(true, "Budget line deleted successfully");
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> ResetFromTemplate(Guid id, AuthenticatedUser user)
    {
        var line = await FetchBudgetLineById(id);

        if (line.TemplateLineId is null)
            throw BusinessException.BadRequest(ErrorCodes.BudgetLineUpdateFailed,
                "Budget line has no associated template");

        var client = _clientFactory.CreateUserClient();
        var templateLineResponse = await client.Table<TemplateLineRow>()
            .Filter("id", Operator.Equals, line.TemplateLineId.Value.ToString())
            .Single();

        if (templateLineResponse is null)
            throw BusinessException.NotFound(ErrorCodes.TemplateLineNotFound,
                $"Template line {line.TemplateLineId} not found");

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var templateAmount = templateLineResponse.Amount is not null
            ? _encryptionService.TryDecryptAmount(templateLineResponse.Amount, dek, 0m)
            : 0m;

        var encryptedAmount = await _encryptionService.PrepareAmountData(templateAmount, user.Id, user.ClientKey);

        var encryptedOriginalAmount = templateLineResponse.OriginalAmount is not null
            ? await _encryptionService.PrepareAmountData(
                _encryptionService.TryDecryptAmount(templateLineResponse.OriginalAmount, dek, 0m),
                user.Id, user.ClientKey)
            : null;

        var updateResponse = await client.Table<BudgetLineRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Set(r => r.Name, templateLineResponse.Name)
            .Set(r => r.Amount, encryptedAmount)
            .Set(r => r.Kind, templateLineResponse.Kind?.ToLowerInvariant())
            .Set(r => r.Recurrence, templateLineResponse.Recurrence?.ToLowerInvariant())
            .Set(r => r.IsManuallyAdjusted, false)
            .Set(r => r.OriginalAmount, encryptedOriginalAmount)
            .Set(r => r.OriginalCurrency, templateLineResponse.OriginalCurrency)
            .Set(r => r.TargetCurrency, templateLineResponse.TargetCurrency)
            .Set(r => r.ExchangeRate, templateLineResponse.ExchangeRate)
            .Update();

        var updatedRow = updateResponse.Models.FirstOrDefault()
            ?? throw new BusinessException(ErrorCodes.BudgetLineUpdateFailed,
                "Failed to reset budget line from template");

        var updatedLine = MapRowToDomainLine(updatedRow);
        var lineDto = MapToResponseDto(updatedLine, dek);

        await _budgetService.RecalculateBalances(updatedLine.BudgetId, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> ToggleCheck(Guid id, AuthenticatedUser user)
    {
        var client = _clientFactory.CreateUserClient();
        var result = await client.Rpc<BudgetLineRow>("toggle_budget_line_check",
            new { p_budget_line_id = id.ToString() });

        if (result is null)
            throw new BusinessException(ErrorCodes.BudgetLineUpdateFailed, "Failed to toggle budget line check");

        var line = MapRowToDomainLine(result);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineDto = MapToResponseDto(line, dek);

        await _cacheService.InvalidateForUser(user.Id);
        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<List<TransactionResponseDto>>> CheckTransactions(Guid id, AuthenticatedUser user)
    {
        var client = _clientFactory.CreateUserClient();
        var results = await client.Rpc<List<TransactionRow>>("check_unchecked_transactions",
            new { p_budget_line_id = id.ToString() });

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var txDtos = (results ?? []).Select(tx => new TransactionResponseDto(
            tx.Id,
            tx.BudgetId,
            tx.BudgetLineId,
            tx.Name ?? string.Empty,
            _encryptionService.TryDecryptAmount(tx.Amount ?? string.Empty, dek, 0m),
            tx.TransactionDate,
            tx.Category,
            tx.Kind,
            tx.CheckedAt,
            tx.CreatedAt,
            tx.UpdatedAt
        )).ToList();

        await _cacheService.InvalidateForUser(user.Id);
        return new ApiResponse<List<TransactionResponseDto>>(true, txDtos);
    }

    private async Task<Domain.Budget.BudgetLine> FetchBudgetLineById(Guid id)
    {
        var client = _clientFactory.CreateUserClient();
        var row = await client.Table<BudgetLineRow>()
            .Filter("id", Operator.Equals, id.ToString())
            .Single();

        if (row is null)
            throw BusinessException.NotFound(ErrorCodes.BudgetLineNotFound, $"Budget line {id} not found");

        return MapRowToDomainLine(row);
    }

    private static void ValidateCreateDto(BudgetLineCreateDto dto)
    {
        if (dto.BudgetId == Guid.Empty)
            throw BusinessException.BadRequest(ErrorCodes.RequiredDataMissing, "BudgetId is required");

        if (dto.Amount < 0)
            throw BusinessException.BadRequest(ErrorCodes.ValidationFailed, "Amount must be greater than or equal to 0");

        if (string.IsNullOrWhiteSpace(dto.Name))
            throw BusinessException.BadRequest(ErrorCodes.RequiredDataMissing, "Name is required");
    }

    private static void ValidateUpdateDto(BudgetLineUpdateDto dto)
    {
        if (dto.Amount.HasValue && dto.Amount.Value < 0)
            throw BusinessException.BadRequest(ErrorCodes.ValidationFailed, "Amount must be greater than or equal to 0");

        if (dto.Name is not null && string.IsNullOrWhiteSpace(dto.Name))
            throw BusinessException.BadRequest(ErrorCodes.RequiredDataMissing, "Name cannot be empty");
    }

    private BudgetLineResponseDto MapToResponseDto(Domain.Budget.BudgetLine line, byte[] dek) =>
        new(
            line.Id,
            line.BudgetId,
            line.TemplateLineId,
            line.SavingsGoalId,
            line.Name,
            _encryptionService.TryDecryptAmount(line.Amount, dek, 0m),
            line.Recurrence,
            line.Kind,
            line.IsManuallyAdjusted,
            line.CheckedAt,
            line.CreatedAt,
            line.UpdatedAt,
            OriginalAmount: line.OriginalAmount is not null
                ? _encryptionService.TryDecryptAmount(line.OriginalAmount, dek, 0m)
                : null,
            OriginalCurrency: CurrencyExtensions.FromIsoCode(line.OriginalCurrency),
            TargetCurrency: CurrencyExtensions.FromIsoCode(line.TargetCurrency),
            ExchangeRate: line.ExchangeRate
        );

    private static Domain.Budget.BudgetLine MapRowToDomainLine(BudgetLineRow row) => new()
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
        OriginalAmount = row.OriginalAmount,
        OriginalCurrency = row.OriginalCurrency,
        TargetCurrency = row.TargetCurrency,
        ExchangeRate = row.ExchangeRate,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

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

    [Table("template_line")]
    private sealed class TemplateLineRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("name")]
        public string? Name { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }

        [Column("kind")]
        public string? Kind { get; set; }

        [Column("recurrence")]
        public string? Recurrence { get; set; }

        [Column("original_amount")]
        public string? OriginalAmount { get; set; }

        [Column("original_currency")]
        public string? OriginalCurrency { get; set; }

        [Column("target_currency")]
        public string? TargetCurrency { get; set; }

        [Column("exchange_rate")]
        public decimal? ExchangeRate { get; set; }
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

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
