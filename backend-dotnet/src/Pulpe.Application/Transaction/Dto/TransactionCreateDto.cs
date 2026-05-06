using Pulpe.Domain.Common;

namespace Pulpe.Application.Transaction.Dto;

public record TransactionCreateDto(
    Guid BudgetId,
    string Name,
    decimal Amount,
    TransactionKind Kind,
    Guid? BudgetLineId = null,
    DateTimeOffset? TransactionDate = null,
    string? Category = null,
    DateTimeOffset? CheckedAt = null
);
