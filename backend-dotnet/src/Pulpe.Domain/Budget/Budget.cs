namespace Pulpe.Domain.Budget;

public sealed class Budget
{
    public Guid Id { get; init; }
    public int Month { get; init; }
    public int Year { get; init; }
    public string Description { get; init; } = string.Empty;
    public string? EndingBalance { get; set; } // Encrypted AES-256-GCM ciphertext
    public Guid? TemplateId { get; init; }
    public Guid UserId { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }

    // Computed (not persisted)
    public decimal? Rollover { get; set; }
    public decimal? Remaining { get; set; }
    public Guid? PreviousBudgetId { get; set; }
}
