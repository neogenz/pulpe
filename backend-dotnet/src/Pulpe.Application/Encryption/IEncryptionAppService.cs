namespace Pulpe.Application.Encryption;

public interface IEncryptionAppService
{
    Task<object> GetVaultStatusAsync(string userId);
    Task<object> GetSaltAsync(string userId);
    Task ValidateKeyAsync(string userId, string clientKeyHex);
    Task VerifyRecoveryKeyAsync(string userId, string recoveryKey);
    Task<object> SetupRecoveryAsync(string userId, byte[] clientKey);
    Task<object> RegenerateRecoveryAsync(string userId, byte[] clientKey);
    Task<object> RecoverAsync(string userId, string recoveryKey, string newClientKeyHex);
    Task<object> ChangePinAsync(string userId, string oldClientKeyHex, string newClientKeyHex);
}
