namespace Pulpe.Api.Api.Auth;

public sealed class SupabaseUser
{
    public string Id { get; init; } = string.Empty;
    public string? Email { get; init; }
    public SupabaseUserMetadata? UserMetadata { get; init; }
}

public sealed class SupabaseUserMetadata
{
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public string? ScheduledDeletionAt { get; init; }
}
