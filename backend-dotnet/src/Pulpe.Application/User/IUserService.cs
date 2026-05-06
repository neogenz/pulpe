using Pulpe.Domain.User;

namespace Pulpe.Application.User;

public interface IUserService
{
    Task<object> GetProfileAsync(AuthenticatedUser user);
    Task<object> UpdateProfileAsync(AuthenticatedUser user, object dto);
    Task<object> CompleteOnboardingAsync(AuthenticatedUser user);
    Task<object> GetOnboardingStatusAsync(AuthenticatedUser user);
    Task<object> GetSettingsAsync(AuthenticatedUser user);
    Task<object> UpdateSettingsAsync(AuthenticatedUser user, object dto);
    Task DeleteAccountAsync(AuthenticatedUser user);
}
