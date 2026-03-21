namespace Pulpe.Api.Domain.Encryption;

public interface IEncryptionService
{
    string EncryptAmount(decimal amount, byte[] dek);
    decimal DecryptAmount(string ciphertext, byte[] dek);
    decimal TryDecryptAmount(string? ciphertext, byte[] dek, decimal fallback = 0m);
    Task<string> PrepareAmountData(decimal amount, string userId, byte[] clientKey);
    Task<byte[]> EnsureUserDek(string userId, byte[] clientKey);
    Task<byte[]> GetUserDek(string userId, byte[] clientKey);
    Task<VaultStatus> GetVaultStatus(string userId);
    Task<SaltInfo> GetUserSalt(string userId);
    (byte[] Raw, string Formatted) GenerateRecoveryKey();
    string WrapDek(byte[] dek, byte[] recoveryKey);
    byte[] UnwrapDek(string wrappedDek, byte[] recoveryKey);
    string GenerateKeyCheck(byte[] dek);
    bool ValidateKeyCheck(string keyCheck, byte[] dek);
    Task<bool> VerifyAndEnsureKeyCheck(string userId, byte[] clientKey);
    Task<string> CreateRecoveryKey(string userId, byte[] clientKey);
    Task<string> RegenerateRecoveryKey(string userId, byte[] clientKey);
    Task RecoverWithKey(string userId, string recoveryKey, byte[] newClientKey, object supabaseClient);
    Task<ChangePinResult> ChangePinRekey(string userId, byte[] oldClientKey, byte[] newClientKey, object supabaseClient);
    Task<string> ReEncryptAllUserData(string userId, byte[] oldDek, byte[] newDek, object supabaseClient);
}

public record VaultStatus(bool PinCodeConfigured, bool RecoveryKeyConfigured, bool VaultCodeConfigured);
public record SaltInfo(string Salt, int KdfIterations, bool HasRecoveryKey);
public record ChangePinResult(string KeyCheck, string RecoveryKey);
