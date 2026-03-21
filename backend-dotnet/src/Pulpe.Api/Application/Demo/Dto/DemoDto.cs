namespace Pulpe.Api.Application.Demo.Dto;

public record DemoSessionCreateDto(string TurnstileToken);

public record DemoSessionResponseDto(bool Success, DemoSessionData Data, string Message);

public record DemoSessionData(DemoSession Session);

public record DemoSession(
    string AccessToken,
    string TokenType,
    int ExpiresIn,
    long ExpiresAt,
    string RefreshToken,
    DemoUser User);

public record DemoUser(string Id, string Email, DateTimeOffset CreatedAt);

public record DemoCleanupResponseDto(bool Success, DemoCleanupData Data, string Message);

public record DemoCleanupData(int Deleted, int Failed);
