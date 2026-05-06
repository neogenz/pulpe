using Pulpe.Domain.Common;

namespace Pulpe.Domain.Budget;

public sealed class BudgetLine
{
    public Guid Id { get; init; }
    public Guid BudgetId { get; init; }
    public Guid? TemplateLineId { get; init; }
    public Guid? SavingsGoalId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Amount { get; set; } = string.Empty; // Encrypted
    public TransactionRecurrence Recurrence { get; init; }
    public TransactionKind Kind { get; init; }
    public bool IsManuallyAdjusted { get; init; }
    public DateTimeOffset? CheckedAt { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
