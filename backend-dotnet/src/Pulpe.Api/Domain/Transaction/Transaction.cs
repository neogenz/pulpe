using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Domain.Transaction;

public sealed class Transaction
{
    public Guid Id { get; init; }
    public Guid BudgetId { get; init; }
    public Guid? BudgetLineId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Amount { get; set; } = string.Empty; // Encrypted
    public DateTimeOffset TransactionDate { get; init; }
    public string? Category { get; init; }
    public TransactionKind Kind { get; init; }
    public DateTimeOffset? CheckedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
