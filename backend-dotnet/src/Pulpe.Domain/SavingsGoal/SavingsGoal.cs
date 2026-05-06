using Pulpe.Domain.Common;

namespace Pulpe.Domain.SavingsGoal;

public sealed class SavingsGoal
{
    public Guid Id { get; init; }
    public Guid UserId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string TargetAmount { get; set; } = string.Empty; // Encrypted
    public DateOnly TargetDate { get; init; }
    public PriorityLevel Priority { get; init; }
    public SavingsGoalStatus Status { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
