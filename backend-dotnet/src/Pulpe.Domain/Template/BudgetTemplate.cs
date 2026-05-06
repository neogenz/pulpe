namespace Pulpe.Domain.Template;

public sealed class BudgetTemplate
{
    public Guid Id { get; init; }
    public Guid? UserId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsDefault { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
