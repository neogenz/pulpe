using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Application.Transaction.Dto;

public record TransactionResponseDto(
    Guid Id,
    Guid BudgetId,
    Guid? BudgetLineId,
    string Name,
    decimal Amount,
    DateTimeOffset TransactionDate,
    string? Category,
    TransactionKind Kind,
    DateTimeOffset? CheckedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);

public record TransactionSearchResultDto(
    Guid Id,
    string ItemType,
    string Name,
    decimal Amount,
    TransactionKind Kind,
    TransactionRecurrence? Recurrence,
    DateTimeOffset? TransactionDate,
    string? Category,
    Guid BudgetId,
    string BudgetName,
    int Year,
    int Month,
    string MonthLabel
);
