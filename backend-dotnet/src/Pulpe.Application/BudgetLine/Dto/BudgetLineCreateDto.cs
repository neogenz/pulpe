using Pulpe.Domain.Common;

namespace Pulpe.Application.BudgetLine.Dto;

public record BudgetLineCreateDto(
    Guid BudgetId,
    string Name,
    decimal Amount,
    TransactionKind Kind,
    TransactionRecurrence Recurrence,
    bool IsManuallyAdjusted = false,
    Guid? TemplateLineId = null,
    Guid? SavingsGoalId = null,
    DateTimeOffset? CheckedAt = null
);
