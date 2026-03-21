using Microsoft.Extensions.Logging;
using Pulpe.Api.Application.BudgetLine.Dto;
using Pulpe.Api.Application.Budget.Dto;
using Pulpe.Api.Application.Common;
using Pulpe.Api.Domain.Budget;
using Pulpe.Api.Domain.Common;
using Pulpe.Api.Domain.Encryption;
using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;
using System.Text.Json.Serialization;

namespace Pulpe.Api.Application.BudgetLine;

public sealed class BudgetLineService : IBudgetLineService
{
    private readonly IBudgetRecalculationService _budgetService;
    private readonly IEncryptionService _encryptionService;
    private readonly ICacheService _cacheService;
    private readonly IBudgetRepository _budgetRepository;
    private readonly ILogger<BudgetLineService> _logger;

    public BudgetLineService(
        IBudgetRecalculationService budgetService,
        IEncryptionService encryptionService,
        ICacheService cacheService,
        IBudgetRepository budgetRepository,
        ILogger<BudgetLineService> logger)
    {
        _budgetService = budgetService;
        _encryptionService = encryptionService;
        _cacheService = cacheService;
        _budgetRepository = budgetRepository;
        _logger = logger;
    }

    public async Task<object> FindByBudgetAsync(Guid budgetId, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var lines = await _budgetRepository.FindLinesByBudgetId(budgetId, supabase);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);

        var lineDtos = lines.Select(line => MapToResponseDto(line, dek)).ToList();
        return new ApiListResponse<BudgetLineResponseDto>(true, lineDtos);
    }

    public async Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var createDto = dto as BudgetLineCreateDto ?? throw new ArgumentException("Expected BudgetLineCreateDto");
        return await Create(createDto, user, supabase);
    }

    public async Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindOne(id, user, supabase);

    public async Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var updateDto = dto as BudgetLineUpdateDto ?? throw new ArgumentException("Expected BudgetLineUpdateDto");
        return await Update(id, updateDto, user, supabase);
    }

    public async Task<object> ResetFromTemplateAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await ResetFromTemplate(id, user, supabase);

    public async Task<object> ToggleCheckAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await ToggleCheck(id, user, supabase);

    public async Task<object> CheckTransactionsAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await CheckTransactions(id, user, supabase);

    public async Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await Remove(id, user, supabase);

    // Typed implementations
    private async Task<ApiResponse<BudgetLineResponseDto>> Create(
        BudgetLineCreateDto dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        ValidateCreateDto(dto);

        var encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount, user.Id, user.ClientKey);

        var insertPayload = new
        {
            budget_id = dto.BudgetId.ToString(),
            name = dto.Name,
            amount = encryptedAmount,
            kind = dto.Kind,
            recurrence = dto.Recurrence,
            is_manually_adjusted = dto.IsManuallyAdjusted,
            template_line_id = dto.TemplateLineId?.ToString(),
            savings_goal_id = dto.SavingsGoalId?.ToString()
        };

        var builder = supabase.From("budget_line").Insert(insertPayload).Select().Single();
        var response = await supabase.Execute<BudgetLineRow>(builder);

        if (!response.IsSuccess || response.Data is null)
            throw new BusinessException(ErrorCodes.BudgetLineCreateFailed,
                response.Error?.Message ?? "Failed to create budget line");

        var line = MapRowToDomainLine(response.Data);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineDto = MapToResponseDto(line, dek);

        await _budgetService.RecalculateBalances(dto.BudgetId, supabase, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> FindOne(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var line = await FetchBudgetLineById(id, user.Id, supabase);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return new ApiResponse<BudgetLineResponseDto>(true, MapToResponseDto(line, dek));
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> Update(
        Guid id, BudgetLineUpdateDto dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        ValidateUpdateDto(dto);

        var updatePayload = new Dictionary<string, object?>();
        if (dto.Name is not null) updatePayload["name"] = dto.Name;
        if (dto.Kind.HasValue) updatePayload["kind"] = dto.Kind.Value.ToString().ToLower();
        if (dto.Recurrence.HasValue) updatePayload["recurrence"] = dto.Recurrence.Value.ToString().ToLower();

        if (dto.Amount.HasValue)
        {
            var encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount.Value, user.Id, user.ClientKey);
            updatePayload["amount"] = encryptedAmount;
        }

        var builder = supabase.From("budget_line")
            .Eq("id", id.ToString())
            .Update(updatePayload);

        var response = await supabase.Execute<List<BudgetLineRow>>(builder);
        var row = response.Data?.FirstOrDefault();

        if (!response.IsSuccess || row is null)
            throw BusinessException.NotFound(ErrorCodes.BudgetLineNotFound, $"Budget line {id} not found");

        var line = MapRowToDomainLine(row);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineDto = MapToResponseDto(line, dek);

        await _budgetService.RecalculateBalances(line.BudgetId, supabase, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<string>> Remove(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        // Pre-fetch budget_id before deletion
        Guid? budgetId = null;
        try
        {
            var line = await FetchBudgetLineById(id, user.Id, supabase);
            budgetId = line.BudgetId;
        }
        catch { /* budget_id fetch failed, proceed with deletion anyway */ }

        var builder = supabase.From("budget_line").Eq("id", id.ToString()).Delete();
        var response = await supabase.Execute<object>(builder);

        if (!response.IsSuccess)
            throw new BusinessException(ErrorCodes.BudgetLineDeleteFailed,
                response.Error?.Message ?? "Failed to delete budget line");

        if (budgetId.HasValue)
            await _budgetService.RecalculateBalances(budgetId.Value, supabase, user.ClientKey);

        await _cacheService.InvalidateForUser(user.Id);
        return new ApiResponse<string>(true, "Budget line deleted successfully");
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> ResetFromTemplate(
        Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var line = await FetchBudgetLineById(id, user.Id, supabase);

        if (line.TemplateLineId is null)
            throw BusinessException.BadRequest(ErrorCodes.BudgetLineUpdateFailed,
                "Budget line has no associated template");

        var templateLineBuilder = supabase.From("template_line")
            .Select("name,amount,kind,recurrence")
            .Eq("id", line.TemplateLineId.Value.ToString())
            .Single();

        var templateResponse = await supabase.Execute<TemplateLineRow>(templateLineBuilder);
        if (!templateResponse.IsSuccess || templateResponse.Data is null)
            throw BusinessException.NotFound(ErrorCodes.TemplateLineNotFound,
                $"Template line {line.TemplateLineId} not found");

        var templateLine = templateResponse.Data;

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var templateAmount = templateLine.Amount is not null
            ? _encryptionService.TryDecryptAmount(templateLine.Amount, dek, 0m)
            : 0m;

        var encryptedAmount = await _encryptionService.PrepareAmountData(templateAmount, user.Id, user.ClientKey);

        var updatePayload = new Dictionary<string, object?>
        {
            ["name"] = templateLine.Name,
            ["amount"] = encryptedAmount,
            ["kind"] = templateLine.Kind,
            ["recurrence"] = templateLine.Recurrence,
            ["is_manually_adjusted"] = false
        };

        var updateBuilder = supabase.From("budget_line")
            .Eq("id", id.ToString())
            .Update(updatePayload);

        var updateResponse = await supabase.Execute<List<BudgetLineRow>>(updateBuilder);
        var updatedRow = updateResponse.Data?.FirstOrDefault();

        if (!updateResponse.IsSuccess || updatedRow is null)
            throw new BusinessException(ErrorCodes.BudgetLineUpdateFailed,
                "Failed to reset budget line from template");

        var updatedLine = MapRowToDomainLine(updatedRow);
        var lineDto = MapToResponseDto(updatedLine, dek);

        await _budgetService.RecalculateBalances(updatedLine.BudgetId, supabase, user.ClientKey);
        await _cacheService.InvalidateForUser(user.Id);

        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<BudgetLineResponseDto>> ToggleCheck(
        Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var rpcResponse = await supabase.Rpc<BudgetLineRow>("toggle_budget_line_check",
            new { p_budget_line_id = id.ToString() });

        if (!rpcResponse.IsSuccess || rpcResponse.Data is null)
            throw new BusinessException(ErrorCodes.BudgetLineUpdateFailed,
                rpcResponse.Error?.Message ?? "Failed to toggle budget line check");

        var line = MapRowToDomainLine(rpcResponse.Data);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineDto = MapToResponseDto(line, dek);

        await _cacheService.InvalidateForUser(user.Id);
        return new ApiResponse<BudgetLineResponseDto>(true, lineDto);
    }

    private async Task<ApiResponse<List<TransactionResponseDto>>> CheckTransactions(
        Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var rpcResponse = await supabase.Rpc<List<TransactionRow>>("check_unchecked_transactions",
            new { p_budget_line_id = id.ToString() });

        if (!rpcResponse.IsSuccess)
            throw new BusinessException(ErrorCodes.BudgetLineUpdateFailed,
                rpcResponse.Error?.Message ?? "Failed to check transactions");

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var txDtos = (rpcResponse.Data ?? []).Select(tx => new TransactionResponseDto(
            Guid.Parse(tx.Id),
            Guid.Parse(tx.BudgetId),
            tx.BudgetLineId is not null ? Guid.Parse(tx.BudgetLineId) : null,
            tx.Name ?? string.Empty,
            _encryptionService.TryDecryptAmount(tx.Amount, dek, 0m),
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

    private async Task<Domain.Budget.BudgetLine> FetchBudgetLineById(Guid id, string userId, SupabaseRestClient supabase)
    {
        var builder = supabase.From("budget_line")
            .Select("*")
            .Eq("id", id.ToString())
            .Single();

        var response = await supabase.Execute<BudgetLineRow>(builder);
        if (!response.IsSuccess || response.Data is null)
            throw BusinessException.NotFound(ErrorCodes.BudgetLineNotFound, $"Budget line {id} not found");

        return MapRowToDomainLine(response.Data);
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
            line.UpdatedAt
        );

    private static Domain.Budget.BudgetLine MapRowToDomainLine(BudgetLineRow row) => new()
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

    private sealed class TemplateLineRow
    {
        public string? Name { get; set; }
        public string? Amount { get; set; }
        public string? Kind { get; set; }
        public string? Recurrence { get; set; }
    }

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
}
