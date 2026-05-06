using Pulpe.Application.Encryption.Dto;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;

namespace Pulpe.Application.Encryption;

public sealed class EncryptionAppService : IEncryptionAppService
{
    private readonly IEncryptionService _encryptionService;

    public EncryptionAppService(IEncryptionService encryptionService)
    {
        _encryptionService = encryptionService;
    }

    public async Task<object> GetVaultStatusAsync(string userId)
    {
        var status = await _encryptionService.GetVaultStatus(userId);
        return new EncryptionVaultStatusResponseDto(
            status.PinCodeConfigured,
            status.RecoveryKeyConfigured,
            status.VaultCodeConfigured
        );
    }

    public async Task<object> GetSaltAsync(string userId)
    {
        var saltInfo = await _encryptionService.GetUserSalt(userId);
        return new EncryptionSaltResponseDto(saltInfo.Salt, saltInfo.KdfIterations, saltInfo.HasRecoveryKey);
    }

    public async Task ValidateKeyAsync(string userId, string clientKeyHex)
    {
        var clientKey = ParseHex(clientKeyHex);
        var valid = await _encryptionService.VerifyAndEnsureKeyCheck(userId, clientKey);

        if (!valid)
            throw new BusinessException(ErrorCodes.EncryptionInvalidKey, "Invalid client key", 401);
    }

    public async Task VerifyRecoveryKeyAsync(string userId, string recoveryKey)
    {
        await _encryptionService.VerifyRecoveryKey(userId, recoveryKey);
    }

    public async Task<object> SetupRecoveryAsync(string userId, byte[] clientKey)
    {
        var formatted = await _encryptionService.CreateRecoveryKey(userId, clientKey);
        return new EncryptionSetupRecoveryResponseDto(formatted);
    }

    public async Task<object> RegenerateRecoveryAsync(string userId, byte[] clientKey)
    {
        var formatted = await _encryptionService.RegenerateRecoveryKey(userId, clientKey);
        return new EncryptionSetupRecoveryResponseDto(formatted);
    }

    public async Task<object> RecoverAsync(string userId, string recoveryKey, string newClientKeyHex)
    {
        var newClientKey = ParseHex(newClientKeyHex);
        await _encryptionService.RecoverWithKey(userId, recoveryKey, newClientKey);
        return new EncryptionRecoverResponseDto(Success: true);
    }

    public async Task<object> ChangePinAsync(string userId, string oldClientKeyHex, string newClientKeyHex)
    {
        var oldKey = ParseHex(oldClientKeyHex);
        var newKey = ParseHex(newClientKeyHex);
        var result = await _encryptionService.ChangePinRekey(userId, oldKey, newKey);
        return new EncryptionChangePinResponseDto(result.KeyCheck, result.RecoveryKey);
    }

    private static byte[] ParseHex(string hex)
    {
        if (string.IsNullOrEmpty(hex) || hex.Length != 64)
            throw new BusinessException(ErrorCodes.AuthClientKeyInvalid, "Client key must be 64 hex characters", 400);

        return Convert.FromHexString(hex);
    }
}
