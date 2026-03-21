namespace Pulpe.Api.Domain.User;

public sealed class AuthenticatedUser
{
    public required string Id { get; init; }
    public required string Email { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public required string AccessToken { get; init; }
    public required byte[] ClientKey { get; init; } // 32 bytes
}
