namespace Pulpe.Domain.Encryption;

public interface IEncryptionKeyRepository
{
    Task<EncryptionKey?> GetByUserId(string userId);
    Task<string> UpsertSalt(string userId, string salt, int kdfIterations);
    Task UpdateKeyCheck(string userId, string keyCheck);
    Task UpdateWrappedDek(string userId, string? wrappedDek);
    Task<bool> HasWrappedDek(string userId);
}
