using Microsoft.Extensions.Logging;
using Pulpe.Application.Common;
using Pulpe.Application.Template.Dto;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Domain.Template;
using Pulpe.Domain.User;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Infrastructure.Services.Template;

public sealed class BudgetTemplateService : ITemplateService
{
    private readonly ITemplateRepository _templateRepository;
    private readonly IBudgetRepository _budgetRepository;
    private readonly IEncryptionService _encryptionService;
    private readonly ICacheService _cacheService;
    private readonly IBudgetRecalculationService _budgetService;
    private readonly ILogger<BudgetTemplateService> _logger;

    public BudgetTemplateService(
        ITemplateRepository templateRepository,
        IBudgetRepository budgetRepository,
        IEncryptionService encryptionService,
        ICacheService cacheService,
        IBudgetRecalculationService budgetService,
        ILogger<BudgetTemplateService> logger)
    {
        _templateRepository = templateRepository;
        _budgetRepository = budgetRepository;
        _encryptionService = encryptionService;
        _cacheService = cacheService;
        _budgetService = budgetService;
        _logger = logger;
    }

    // ============ TEMPLATE METHODS ============

    public async Task<List<BudgetTemplateResponseDto>> FindAll(AuthenticatedUser user, object supabase)
    {
        var templates = await _templateRepository.FindAll(user.Id, supabase);
        return templates.Select(MapToTemplateResponse).ToList();
    }

    public async Task<BudgetTemplateResponseDto> FindOne(Guid id, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(id, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{id}' not found");

        ValidateTemplateOwnership(template, user.Id);
        return MapToTemplateResponse(template);
    }

    public async Task<BudgetTemplateWithLinesResponseDto> Create(
        BudgetTemplateCreateDto dto, AuthenticatedUser user, object supabase)
    {
        var count = await _templateRepository.CountByUserId(user.Id, supabase);
        if (count >= Constants.MaxTemplatesPerUser)
            throw BusinessException.BadRequest(
                ErrorCodes.TemplateLimitReached,
                $"Maximum of {Constants.MaxTemplatesPerUser} templates per user reached");

        if (dto.IsDefault)
            await _templateRepository.ResetDefaultTemplates(user.Id, null, supabase);

        var lines = dto.Lines ?? [];
        var encryptedLines = await EncryptTemplateLines(lines, user);

        var rpcPayload = new
        {
            p_user_id = user.Id,
            p_name = dto.Name,
            p_description = dto.Description,
            p_is_default = dto.IsDefault,
            p_lines = encryptedLines
        };

        var template = await _templateRepository.Create(rpcPayload, supabase);
        var templateLines = await _templateRepository.FindTemplateLines(template.Id, supabase);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var lineResponses = templateLines.Select(l => MapToLineResponse(l, dek)).ToList();

        _logger.LogInformation("Template {TemplateId} created by user {UserId}", template.Id, user.Id);

        return new BudgetTemplateWithLinesResponseDto(MapToTemplateResponse(template), lineResponses);
    }

    public async Task<BudgetTemplateResponseDto> Update(
        Guid id, BudgetTemplateUpdateDto dto, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(id, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{id}' not found");

        ValidateTemplateOwnership(template, user.Id);

        if (dto.IsDefault == true)
            await _templateRepository.ResetDefaultTemplates(user.Id, id, supabase);

        var updateData = BuildTemplateUpdatePayload(dto);
        var updated = await _templateRepository.Update(id, updateData, supabase);

        _logger.LogInformation("Template {TemplateId} updated by user {UserId}", id, user.Id);
        return MapToTemplateResponse(updated);
    }

    public async Task Remove(Guid id, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(id, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{id}' not found");

        ValidateTemplateOwnership(template, user.Id);

        var usage = await CheckTemplateUsageInternal(id, user.Id, supabase);
        if (usage.IsUsed)
            throw BusinessException.Conflict(
                ErrorCodes.TemplateInUse,
                $"Template '{id}' is used by {usage.BudgetCount} budget(s) and cannot be deleted");

        await _templateRepository.Delete(id, supabase);
        _logger.LogInformation("Template {TemplateId} deleted by user {UserId}", id, user.Id);
    }

    public async Task<TemplateUsageResponseDto> CheckTemplateUsage(Guid id, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(id, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{id}' not found");

        ValidateTemplateOwnership(template, user.Id);

        var budgets = await _budgetRepository.FindAll(user.Id, supabase);
        var usedBy = budgets.Where(b => b.TemplateId == id).ToList();

        return new TemplateUsageResponseDto(
            IsUsed: usedBy.Count > 0,
            BudgetCount: usedBy.Count,
            Budgets: usedBy.Select(b => new TemplateBudgetReferenceDto(b.Id, b.Month, b.Year, b.Description)).ToList()
        );
    }

    public async Task<BudgetTemplateWithLinesResponseDto> CreateFromOnboarding(
        BudgetTemplateCreateFromOnboardingDto dto, AuthenticatedUser user, object supabase)
    {
        await CheckOnboardingRateLimit(user.Id, supabase);

        var lines = BuildOnboardingTemplateLines(dto);
        var createDto = new BudgetTemplateCreateDto(
            Name: dto.Name,
            Description: dto.Description,
            IsDefault: dto.IsDefault,
            Lines: lines
        );

        return await Create(createDto, user, supabase);
    }

    // ============ TEMPLATE LINE METHODS ============

    public async Task<List<TemplateLineResponseDto>> FindTemplateLines(
        Guid templateId, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(templateId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{templateId}' not found");

        ValidateTemplateOwnership(template, user.Id);

        var lines = await _templateRepository.FindTemplateLines(templateId, supabase);
        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return lines.Select(l => MapToLineResponse(l, dek)).ToList();
    }

    public async Task<TemplateLineResponseDto> CreateTemplateLine(
        Guid templateId, TemplateLineCreateDto dto, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(templateId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{templateId}' not found");

        ValidateTemplateOwnership(template, user.Id);

        var encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount, user.Id, user.ClientKey);

        var createData = new
        {
            template_id = templateId.ToString(),
            name = dto.Name,
            amount = encryptedAmount,
            kind = dto.Kind,
            recurrence = dto.Recurrence,
            description = dto.Description ?? string.Empty,
        };

        var created = await _templateRepository.CreateTemplateLine(createData, supabase);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToLineResponse(created, dek);
    }

    public async Task<TemplateLineResponseDto> FindTemplateLine(
        Guid lineId, AuthenticatedUser user, object supabase)
    {
        var line = await _templateRepository.FindTemplateLine(lineId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateLineNotFound, $"Template line '{lineId}' not found");

        // Validate access via template
        var template = await _templateRepository.FindById(line.TemplateId, supabase);
        if (template is null || template.UserId != Guid.Parse(user.Id))
            throw BusinessException.Forbidden(ErrorCodes.TemplateAccessDenied, "Access to template line denied");

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToLineResponse(line, dek);
    }

    public async Task<TemplateLineResponseDto> UpdateTemplateLine(
        Guid lineId, TemplateLineUpdateDto dto, AuthenticatedUser user, object supabase)
    {
        var line = await _templateRepository.FindTemplateLine(lineId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateLineNotFound, $"Template line '{lineId}' not found");

        var template = await _templateRepository.FindById(line.TemplateId, supabase);
        if (template is null || template.UserId != Guid.Parse(user.Id))
            throw BusinessException.Forbidden(ErrorCodes.TemplateAccessDenied, "Access to template line denied");

        string? encryptedAmount = null;
        if (dto.Amount.HasValue)
            encryptedAmount = await _encryptionService.PrepareAmountData(dto.Amount.Value, user.Id, user.ClientKey);

        var updateData = BuildLineUpdatePayload(dto, encryptedAmount);
        var updated = await _templateRepository.UpdateTemplateLine(lineId, updateData, supabase);

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        return MapToLineResponse(updated, dek);
    }

    public async Task DeleteTemplateLine(Guid lineId, AuthenticatedUser user, object supabase)
    {
        var line = await _templateRepository.FindTemplateLine(lineId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateLineNotFound, $"Template line '{lineId}' not found");

        var template = await _templateRepository.FindById(line.TemplateId, supabase);
        if (template is null || template.UserId != Guid.Parse(user.Id))
            throw BusinessException.Forbidden(ErrorCodes.TemplateAccessDenied, "Access to template line denied");

        await _templateRepository.DeleteTemplateLine(lineId, supabase);
    }

    public async Task<List<TemplateLineResponseDto>> BulkUpdateTemplateLines(
        Guid templateId, TemplateLinesBulkUpdateDto dto, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(templateId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{templateId}' not found");

        ValidateTemplateOwnership(template, user.Id);

        var lineIds = dto.Lines.Select(l => l.Id).ToList();
        var existingLines = await _templateRepository.FindTemplateLines(templateId, supabase);
        var existingIds = existingLines.Select(l => l.Id).ToHashSet();

        foreach (var lineId in lineIds)
        {
            if (!existingIds.Contains(lineId))
                throw BusinessException.BadRequest(
                    ErrorCodes.TemplateLineNotFound,
                    $"Template line '{lineId}' not found in template '{templateId}'");
        }

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);
        var results = new List<TemplateLine>();

        // Group lines by identical update properties to minimize DB round trips
        var updateGroups = await GroupLinesByUpdateProperties(dto.Lines, user);
        foreach (var (_, (ids, updateData)) in updateGroups)
        {
            foreach (var id in ids)
            {
                var updated = await _templateRepository.UpdateTemplateLine(id, updateData, supabase);
                results.Add(updated);
            }
        }

        return results.Select(l => MapToLineResponse(l, dek)).ToList();
    }

    public async Task<BulkOperationsResultDto> BulkOperationsTemplateLines(
        Guid templateId, TemplateLinesBulkOperationsDto dto, AuthenticatedUser user, object supabase)
    {
        var template = await _templateRepository.FindById(templateId, supabase)
            ?? throw BusinessException.NotFound(ErrorCodes.TemplateNotFound, $"Template '{templateId}' not found");

        ValidateTemplateOwnership(template, user.Id);

        var totalOps = (dto.Create?.Count ?? 0) + (dto.Update?.Count ?? 0) + (dto.Delete?.Count ?? 0);
        if (totalOps > Constants.MaxBulkOperations)
            throw BusinessException.BadRequest(
                ErrorCodes.TemplateBulkOperationsFailed,
                $"Total operations cannot exceed {Constants.MaxBulkOperations}");

        var dek = await _encryptionService.GetUserDek(user.Id, user.ClientKey);

        // Execute in order: delete → update → create
        var deletedIds = new List<Guid>();
        var updatedLines = new List<TemplateLine>();
        var createdLines = new List<TemplateLine>();

        if (dto.Delete?.Count > 0)
        {
            foreach (var lineId in dto.Delete)
            {
                await _templateRepository.DeleteTemplateLine(lineId, supabase);
                deletedIds.Add(lineId);
            }
        }

        if (dto.Update?.Count > 0)
        {
            foreach (var lineUpdate in dto.Update)
            {
                string? encryptedAmount = null;
                if (lineUpdate.Amount.HasValue)
                    encryptedAmount = await _encryptionService.PrepareAmountData(lineUpdate.Amount.Value, user.Id, user.ClientKey);

                var updateLineDto = new TemplateLineUpdateDto(
                    lineUpdate.Name, lineUpdate.Amount, lineUpdate.Kind,
                    lineUpdate.Recurrence, lineUpdate.Description);

                var updateData = BuildLineUpdatePayload(updateLineDto, encryptedAmount);
                var updated = await _templateRepository.UpdateTemplateLine(lineUpdate.Id, updateData, supabase);
                updatedLines.Add(updated);
            }
        }

        if (dto.Create?.Count > 0)
        {
            foreach (var lineCreate in dto.Create)
            {
                var encryptedAmount = await _encryptionService.PrepareAmountData(lineCreate.Amount, user.Id, user.ClientKey);
                var createData = new
                {
                    template_id = templateId.ToString(),
                    name = lineCreate.Name,
                    amount = encryptedAmount,
                    kind = lineCreate.Kind,
                    recurrence = lineCreate.Recurrence,
                    description = lineCreate.Description ?? string.Empty,
                };
                var created = await _templateRepository.CreateTemplateLine(createData, supabase);
                createdLines.Add(created);
            }
        }

        PropagationSummaryDto propagation;

        if (dto.PropagateToBudgets)
        {
            var affectedBudgetIds = await PropagateChangesToBudgets(
                templateId, user, supabase, deletedIds, updatedLines, createdLines);

            propagation = new PropagationSummaryDto("propagate", affectedBudgetIds, affectedBudgetIds.Count);

            if (affectedBudgetIds.Count > 0)
                await _cacheService.InvalidateForUser(user.Id);
        }
        else
        {
            propagation = new PropagationSummaryDto("template-only", [], 0);
        }

        _logger.LogInformation(
            "Bulk operations on template {TemplateId} by user {UserId}: {DeleteCount} deleted, {UpdateCount} updated, {CreateCount} created",
            templateId, user.Id, deletedIds.Count, updatedLines.Count, createdLines.Count);

        return new BulkOperationsResultDto(
            Created: createdLines.Select(l => MapToLineResponse(l, dek)).ToList(),
            Updated: updatedLines.Select(l => MapToLineResponse(l, dek)).ToList(),
            Deleted: deletedIds,
            Propagation: propagation
        );
    }

    // ============ PRIVATE HELPERS ============

    private static void ValidateTemplateOwnership(BudgetTemplate template, string userId)
    {
        if (template.UserId is not null && template.UserId.ToString() != userId)
            throw BusinessException.Forbidden(ErrorCodes.TemplateAccessDenied, "Access to template denied");
    }

    private async Task<(bool IsUsed, int BudgetCount)> CheckTemplateUsageInternal(Guid templateId, string userId, object supabase)
    {
        var budgets = await _budgetRepository.FindAll(userId, supabase);
        var count = budgets.Count(b => b.TemplateId == templateId);
        return (count > 0, count);
    }

    private async Task CheckOnboardingRateLimit(string userId, object supabase)
    {
        var templates = await _templateRepository.FindAll(userId, supabase);
        if (templates.Count == 0) return;

        var mostRecent = templates.Max(t => t.CreatedAt);
        if (mostRecent > DateTimeOffset.UtcNow.AddHours(-24))
        {
            throw BusinessException.BadRequest(
                ErrorCodes.TemplateOnboardingRateLimit,
                "A template was already created in the last 24 hours. Please wait before creating another from onboarding.");
        }
    }

    private async Task<List<Guid>> PropagateChangesToBudgets(
        Guid templateId, AuthenticatedUser user, object supabase,
        List<Guid> deletedIds, List<TemplateLine> updatedLines, List<TemplateLine> createdLines)
    {
        var now = DateTimeOffset.UtcNow;
        var allBudgets = await _budgetRepository.FindAll(user.Id, supabase);
        var futureBudgets = allBudgets
            .Where(b => b.TemplateId == templateId)
            .Where(b => b.Year > now.Year || (b.Year == now.Year && b.Month >= now.Month))
            .ToList();

        if (futureBudgets.Count == 0)
            return [];

        var budgetIds = futureBudgets.Select(b => b.Id).ToList();
        var client = (SupabaseRestClient)supabase;

        var rpcArgs = new
        {
            template_id = templateId.ToString(),
            budget_ids = budgetIds.Select(id => id.ToString()).ToArray(),
            delete_ids = deletedIds.Select(id => id.ToString()).ToArray(),
            updated_lines = updatedLines.Select(MapLineForRpc).ToArray(),
            created_lines = createdLines.Select(MapLineForRpc).ToArray()
        };

        // Local function — uses enum values directly so JsonStringEnumConverter serializes to "one_off" not "oneoff"
        static object MapLineForRpc(TemplateLine l) => new
        {
            id = l.Id.ToString(),
            name = l.Name,
            amount = l.Amount,
            kind = l.Kind,
            recurrence = l.Recurrence,
        };

        var rpcResponse = await client.Rpc<object>("apply_template_line_operations", rpcArgs);
        if (!rpcResponse.IsSuccess)
        {
            _logger.LogWarning("Template propagation RPC failed for template {TemplateId}: {Error}",
                templateId, rpcResponse.Error?.Message);
            throw new BusinessException(ErrorCodes.TemplatePropagationFailed,
                "Failed to propagate template changes to budgets");
        }

        foreach (var budgetId in budgetIds)
        {
            await _budgetService.RecalculateBalances(budgetId, supabase, user.ClientKey);
        }

        return budgetIds;
    }

    private async Task<Dictionary<string, (List<Guid> Ids, object UpdateData)>> GroupLinesByUpdateProperties(
        List<TemplateLineUpdateWithIdDto> lines, AuthenticatedUser user)
    {
        var groups = new Dictionary<string, (List<Guid> Ids, object UpdateData)>();

        foreach (var line in lines)
        {
            string? encryptedAmount = null;
            if (line.Amount.HasValue)
                encryptedAmount = await _encryptionService.PrepareAmountData(line.Amount.Value, user.Id, user.ClientKey);

            var updateDto = new TemplateLineUpdateDto(line.Name, line.Amount, line.Kind, line.Recurrence, line.Description);
            var updateData = BuildLineUpdatePayload(updateDto, encryptedAmount);

            var key = System.Text.Json.JsonSerializer.Serialize(updateData);
            if (!groups.ContainsKey(key))
                groups[key] = ([], updateData);

            groups[key].Ids.Add(line.Id);
        }

        return groups;
    }

    private async Task<List<object>> EncryptTemplateLines(List<TemplateLineCreateDto> lines, AuthenticatedUser user)
    {
        var result = new List<object>();
        foreach (var line in lines)
        {
            var encryptedAmount = await _encryptionService.PrepareAmountData(line.Amount, user.Id, user.ClientKey);
            result.Add(new
            {
                name = line.Name,
                amount = encryptedAmount,
                kind = line.Kind,
                recurrence = line.Recurrence,
                description = line.Description ?? string.Empty,
            });
        }
        return result;
    }

    private List<TemplateLineCreateDto> BuildOnboardingTemplateLines(BudgetTemplateCreateFromOnboardingDto dto)
    {
        var lines = new List<TemplateLineCreateDto>();

        var fieldMappings = new[]
        {
            (Field: dto.MonthlyIncome, Name: "Salaire", Kind: TransactionKind.Income, Desc: "Salaire & revenus mensuels"),
            (Field: dto.HousingCosts, Name: "Loyer", Kind: TransactionKind.Expense, Desc: "Loyer, assurances, etc."),
            (Field: dto.HealthInsurance, Name: "Assurance maladie", Kind: TransactionKind.Expense, Desc: "Assurance maladie, etc."),
            (Field: dto.PhonePlan, Name: "Téléphone", Kind: TransactionKind.Expense, Desc: "Frais de téléphone"),
            (Field: dto.InternetPlan, Name: "Internet", Kind: TransactionKind.Expense, Desc: "Abonnement internet"),
            (Field: dto.TransportCosts, Name: "Transport", Kind: TransactionKind.Expense, Desc: "Transport en commun, véhicule, etc."),
            (Field: dto.LeasingCredit, Name: "Leasing", Kind: TransactionKind.Expense, Desc: "Crédit, leasing, etc."),
        };

        foreach (var (amount, name, kind, desc) in fieldMappings)
        {
            if (amount > 0)
                lines.Add(new TemplateLineCreateDto(name, amount, kind, TransactionRecurrence.Fixed, desc));
        }

        if (dto.CustomTransactions is not null)
        {
            foreach (var t in dto.CustomTransactions)
                lines.Add(new TemplateLineCreateDto(t.Name, t.Amount, t.Type, t.ExpenseType, t.Description));
        }

        return lines;
    }

    private static object BuildTemplateUpdatePayload(BudgetTemplateUpdateDto dto)
    {
        var dict = new Dictionary<string, object?>();
        if (dto.Name is not null) dict["name"] = dto.Name;
        if (dto.Description is not null) dict["description"] = dto.Description;
        if (dto.IsDefault.HasValue) dict["is_default"] = dto.IsDefault.Value;
        dict["updated_at"] = DateTimeOffset.UtcNow.ToString("O");
        return dict;
    }

    private static object BuildLineUpdatePayload(TemplateLineUpdateDto dto, string? encryptedAmount)
    {
        var dict = new Dictionary<string, object?>();
        if (dto.Name is not null) dict["name"] = dto.Name;
        if (encryptedAmount is not null) dict["amount"] = encryptedAmount;
        if (dto.Kind.HasValue) dict["kind"] = dto.Kind.Value;
        if (dto.Recurrence.HasValue) dict["recurrence"] = dto.Recurrence.Value;
        if (dto.Description is not null) dict["description"] = dto.Description;
        dict["updated_at"] = DateTimeOffset.UtcNow.ToString("O");
        return dict;
    }

    private TemplateLineResponseDto MapToLineResponse(TemplateLine line, byte[] dek) =>
        new(
            Id: line.Id,
            TemplateId: line.TemplateId,
            Name: line.Name,
            Amount: _encryptionService.TryDecryptAmount(line.Amount, dek),
            Description: line.Description,
            Recurrence: line.Recurrence,
            Kind: line.Kind,
            CreatedAt: line.CreatedAt,
            UpdatedAt: line.UpdatedAt
        );

    private static BudgetTemplateResponseDto MapToTemplateResponse(BudgetTemplate t) =>
        new(
            Id: t.Id,
            UserId: t.UserId,
            Name: t.Name,
            Description: t.Description,
            IsDefault: t.IsDefault,
            CreatedAt: t.CreatedAt,
            UpdatedAt: t.UpdatedAt
        );

    // ITemplateService bridge methods
    public async Task<object> FindAllAsync(AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindAll(user, supabase);

    public async Task<object> CreateAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var createDto = dto as BudgetTemplateCreateDto ?? throw new ArgumentException("Expected BudgetTemplateCreateDto");
        return await Create(createDto, user, supabase);
    }

    public async Task<object> CreateFromOnboardingAsync(object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var onboardingDto = dto as BudgetTemplateCreateFromOnboardingDto ?? throw new ArgumentException("Expected BudgetTemplateCreateFromOnboardingDto");
        return await CreateFromOnboarding(onboardingDto, user, supabase);
    }

    public async Task<object> CheckUsageAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await CheckTemplateUsage(id, user, supabase);

    public async Task<object> FindOneAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindOne(id, user, supabase);

    public async Task<object> UpdateAsync(Guid id, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var updateDto = dto as BudgetTemplateUpdateDto ?? throw new ArgumentException("Expected BudgetTemplateUpdateDto");
        return await Update(id, updateDto, user, supabase);
    }

    public async Task<object> FindTemplateLinesAsync(Guid templateId, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindTemplateLines(templateId, user, supabase);

    public async Task<object> BulkUpdateTemplateLinesAsync(Guid templateId, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var bulkDto = dto as TemplateLinesBulkUpdateDto ?? throw new ArgumentException("Expected TemplateLinesBulkUpdateDto");
        return await BulkUpdateTemplateLines(templateId, bulkDto, user, supabase);
    }

    public async Task<object> BulkOperationsTemplateLinesAsync(Guid templateId, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var bulkDto = dto as TemplateLinesBulkOperationsDto ?? throw new ArgumentException("Expected TemplateLinesBulkOperationsDto");
        return await BulkOperationsTemplateLines(templateId, bulkDto, user, supabase);
    }

    public async Task<object> CreateTemplateLineAsync(Guid templateId, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var lineDto = dto as TemplateLineCreateDto ?? throw new ArgumentException("Expected TemplateLineCreateDto");
        return await CreateTemplateLine(templateId, lineDto, user, supabase);
    }

    public async Task<object> FindTemplateLineAsync(Guid lineId, AuthenticatedUser user, SupabaseRestClient supabase)
        => await FindTemplateLine(lineId, user, supabase);

    public async Task<object> UpdateTemplateLineAsync(Guid lineId, object dto, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        var lineDto = dto as TemplateLineUpdateDto ?? throw new ArgumentException("Expected TemplateLineUpdateDto");
        return await UpdateTemplateLine(lineId, lineDto, user, supabase);
    }

    public async Task<object> DeleteTemplateLineAsync(Guid lineId, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        await DeleteTemplateLine(lineId, user, supabase);
        return new { success = true };
    }

    public async Task<object> RemoveAsync(Guid id, AuthenticatedUser user, SupabaseRestClient supabase)
    {
        await Remove(id, user, supabase);
        return new { success = true };
    }
}
