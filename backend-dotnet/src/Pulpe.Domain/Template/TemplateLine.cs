using Pulpe.Domain.Common;

namespace Pulpe.Domain.Template;

public sealed class TemplateLine
{
    public Guid Id { get; init; }
    public Guid TemplateId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Amount { get; set; } = string.Empty; // Encrypted
    public string? Description { get; init; }
    public TransactionRecurrence Recurrence { get; init; }
    public TransactionKind Kind { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
