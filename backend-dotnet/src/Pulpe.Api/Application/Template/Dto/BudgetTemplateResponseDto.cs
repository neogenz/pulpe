using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Application.Template.Dto;

public record BudgetTemplateResponseDto(
    Guid Id,
    Guid? UserId,
    string Name,
    string? Description,
    bool IsDefault,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record TemplateLineResponseDto(
    Guid Id,
    Guid TemplateId,
    string Name,
    decimal Amount,
    string? Description,
    TransactionRecurrence Recurrence,
    TransactionKind Kind,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record BudgetTemplateWithLinesResponseDto(
    BudgetTemplateResponseDto Template,
    List<TemplateLineResponseDto> Lines
);

public record TemplateUsageResponseDto(
    bool IsUsed,
    int BudgetCount,
    List<TemplateBudgetReferenceDto> Budgets
);

public record TemplateBudgetReferenceDto(Guid Id, int Month, int Year, string Description);

public record BulkOperationsResultDto(
    List<TemplateLineResponseDto> Created,
    List<TemplateLineResponseDto> Updated,
    List<Guid> Deleted,
    PropagationSummaryDto? Propagation
);

public record PropagationSummaryDto(
    string Mode,
    List<Guid> AffectedBudgetIds,
    int AffectedBudgetsCount
);
