using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.Encryption;

public interface IEncryptionAppService
{
    Task<object> GetVaultStatusAsync(string userId);
    Task<object> GetSaltAsync(string userId);
    Task ValidateKeyAsync(string userId, string clientKeyHex);
    Task<object> SetupRecoveryAsync(string userId, byte[] clientKey);
    Task<object> RegenerateRecoveryAsync(string userId, byte[] clientKey);
    Task<object> RecoverAsync(string userId, string recoveryKey, string newClientKeyHex, SupabaseRestClient supabase);
    Task<object> ChangePinAsync(string userId, string oldClientKeyHex, string newClientKeyHex, SupabaseRestClient supabase);
}
