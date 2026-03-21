using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.Demo;

public sealed class DemoCleanupService
{
    private readonly SupabaseAuthClient _authClient;
    private readonly ILogger<DemoCleanupService> _logger;
    private const int PerPage = 1000;

    public DemoCleanupService(SupabaseAuthClient authClient, ILogger<DemoCleanupService> logger)
    {
        _authClient = authClient;
        _logger = logger;
    }

    public async Task<(int Deleted, int Failed)> CleanupExpiredDemoUsers()
    {
        return await CleanupDemoUsersByAge(24);
    }

    public async Task<(int Deleted, int Failed)> CleanupDemoUsersByAge(int maxAgeHours)
    {
        _logger.LogInformation("Starting demo users cleanup (maxAgeHours={MaxAge})", maxAgeHours);

        var cutoff = DateTimeOffset.UtcNow.AddHours(-maxAgeHours);
        var expiredUsers = await FindExpiredDemoUsers(cutoff);

        if (expiredUsers.Count == 0)
        {
            _logger.LogInformation("No expired demo users to cleanup");
            return (0, 0);
        }

        var deleted = 0;
        var failed = 0;

        foreach (var userId in expiredUsers)
        {
            try
            {
                await _authClient.AdminDeleteUser(userId);
                _logger.LogInformation("Demo user deleted {UserId}", userId);
                deleted++;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete demo user {UserId}", userId);
                failed++;
            }
        }

        _logger.LogInformation(
            "Demo cleanup completed: {Deleted} deleted, {Failed} failed",
            deleted, failed);

        return (deleted, failed);
    }

    private async Task<List<string>> FindExpiredDemoUsers(DateTimeOffset cutoff)
    {
        var expired = new List<string>();
        var page = 1;

        while (true)
        {
            var pageData = await _authClient.AdminListUsers<AdminUsersPage>(page, PerPage);
            if (pageData is null) break;

            var users = pageData.Users ?? new List<AdminUser>();

            foreach (var user in users)
            {
                if (user.UserMetadata?.IsDemo == true && user.CreatedAt < cutoff)
                    expired.Add(user.Id);
            }

            if (users.Count < PerPage) break;
            page++;
        }

        _logger.LogInformation("Found {Count} expired demo users", expired.Count);
        return expired;
    }

    private sealed class AdminUsersPage
    {
        public List<AdminUser>? Users { get; set; }
    }

    private sealed class AdminUser
    {
        public string Id { get; set; } = string.Empty;
        public string? Email { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public AdminUserMetadata? UserMetadata { get; set; }
    }

    private sealed class AdminUserMetadata
    {
        public bool? IsDemo { get; set; }
    }
}
