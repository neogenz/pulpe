namespace Pulpe.Infrastructure.Encryption;

public sealed class EncryptionOptions
{
    public const string Section = "Encryption";
    public string MasterKey { get; set; } = string.Empty; // 64 hex chars = 32 bytes
}
