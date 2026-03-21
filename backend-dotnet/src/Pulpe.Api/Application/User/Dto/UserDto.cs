namespace Pulpe.Api.Application.User.Dto;

public record UserProfileResponseDto(bool Success, UserProfileDto User);

public record UserProfileDto(string Id, string Email, string? FirstName, string? LastName, int? PayDayOfMonth);

public record UpdateProfileDto(string FirstName, string LastName);

public record UpdateUserSettingsDto(int? PayDayOfMonth);

public record UserSettingsDto(int? PayDayOfMonth);

public record OnboardingStatusResponseDto(bool Success, bool OnboardingCompleted);

public record DeleteAccountResponseDto(bool Success, string Message, DateTimeOffset ScheduledDeletionAt);
