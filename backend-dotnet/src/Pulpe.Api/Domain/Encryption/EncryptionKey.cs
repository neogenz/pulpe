namespace Pulpe.Api.Domain.Encryption;

public sealed class EncryptionKey
{
    public Guid UserId { get; init; }
    public string Salt { get; init; } = string.Empty;
    public int KdfIterations { get; init; } = 600_000;
    public string? WrappedDek { get; init; }
    public string? KeyCheck { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; init; }
}
