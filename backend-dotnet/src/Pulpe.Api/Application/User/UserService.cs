using Pulpe.Api.Application.User.Dto;
using Pulpe.Api.Domain.User;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.User;

public sealed class UserService : IUserService
{
    private readonly SupabaseAuthClient _authClient;
    private readonly ILogger<UserService> _logger;

    private static readonly System.Text.Json.JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public UserService(SupabaseAuthClient authClient, ILogger<UserService> logger)
    {
        _authClient = authClient;
        _logger = logger;
    }

    public async Task<object> GetProfileAsync(AuthenticatedUser user)
    {
        var response = await _authClient.GetUser<SupabaseUserProfile>(user.AccessToken);
        var metadata = response?.UserMetadata;
        var payDay = metadata?.PayDayOfMonth;

        return new UserProfileResponseDto(
            Success: true,
            User: new UserProfileDto(
                Id: user.Id,
                Email: user.Email,
                FirstName: user.FirstName ?? metadata?.FirstName,
                LastName: user.LastName ?? metadata?.LastName,
                PayDayOfMonth: payDay
            )
        );
    }

    public async Task<object> UpdateProfileAsync(AuthenticatedUser user, object dto)
    {
        var updateDto = dto as UpdateProfileDto ?? throw new ArgumentException("Expected UpdateProfileDto");

        await _authClient.AdminUpdateUser<object>(user.Id, new
        {
            user_metadata = new
            {
                first_name = updateDto.FirstName,
                last_name = updateDto.LastName
            }
        });

        _logger.LogInformation("Profile updated for user {UserId}", user.Id);

        return new UserProfileResponseDto(
            Success: true,
            User: new UserProfileDto(
                Id: user.Id,
                Email: user.Email,
                FirstName: updateDto.FirstName,
                LastName: updateDto.LastName,
                PayDayOfMonth: null
            )
        );
    }

    public async Task<object> CompleteOnboardingAsync(AuthenticatedUser user)
    {
        await _authClient.AdminUpdateUser<object>(user.Id, new
        {
            user_metadata = new { onboarding_completed = true }
        });

        _logger.LogInformation("Onboarding completed for user {UserId}", user.Id);
        return new { success = true };
    }

    public async Task<object> GetOnboardingStatusAsync(AuthenticatedUser user)
    {
        var response = await _authClient.GetUser<SupabaseUserProfile>(user.AccessToken);
        var completed = response?.UserMetadata?.OnboardingCompleted ?? false;

        return new OnboardingStatusResponseDto(Success: true, OnboardingCompleted: completed);
    }

    public async Task<object> GetSettingsAsync(AuthenticatedUser user)
    {
        var response = await _authClient.GetUser<SupabaseUserProfile>(user.AccessToken);
        var payDay = response?.UserMetadata?.PayDayOfMonth;

        return new UserSettingsDto(PayDayOfMonth: payDay);
    }

    public async Task<object> UpdateSettingsAsync(AuthenticatedUser user, object dto)
    {
        var settingsDto = dto as UpdateUserSettingsDto ?? throw new ArgumentException("Expected UpdateUserSettingsDto");

        await _authClient.AdminUpdateUser<object>(user.Id, new
        {
            user_metadata = new { pay_day_of_month = settingsDto.PayDayOfMonth }
        });

        _logger.LogInformation("Settings updated for user {UserId}", user.Id);
        return new UserSettingsDto(PayDayOfMonth: settingsDto.PayDayOfMonth);
    }

    public async Task DeleteAccountAsync(AuthenticatedUser user)
    {
        var scheduledAt = DateTimeOffset.UtcNow;

        await _authClient.AdminUpdateUser<object>(user.Id, new
        {
            user_metadata = new { scheduled_deletion_at = scheduledAt.ToString("O") }
        });

        _logger.LogInformation("Account deletion scheduled for user {UserId} at {ScheduledAt}", user.Id, scheduledAt);
    }

    private sealed class SupabaseUserProfile
    {
        public SupabaseUserProfileMetadata? UserMetadata { get; init; }
    }

    private sealed class SupabaseUserProfileMetadata
    {
        public string? FirstName { get; init; }
        public string? LastName { get; init; }
        public int? PayDayOfMonth { get; init; }
        public bool OnboardingCompleted { get; init; }
    }
}
