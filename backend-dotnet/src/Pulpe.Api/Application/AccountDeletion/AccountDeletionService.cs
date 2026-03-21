using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Application.AccountDeletion;

public sealed class AccountDeletionService
{
    private readonly SupabaseAuthClient _authClient;
    private readonly ILogger<AccountDeletionService> _logger;
    private const int GracePeriodDays = 3;
    private const int MaxPages = 100;
    private const int PerPage = 1000;

    public AccountDeletionService(SupabaseAuthClient authClient, ILogger<AccountDeletionService> logger)
    {
        _authClient = authClient;
        _logger = logger;
    }

    public async Task CleanupScheduledDeletions()
    {
        var startTime = DateTimeOffset.UtcNow;
        _logger.LogInformation("Starting scheduled account deletion cleanup");

        try
        {
            var expiredUsers = await FindExpiredScheduledUsers(startTime);

            if (expiredUsers.Count == 0)
            {
                _logger.LogInformation("No expired scheduled deletions to process");
                return;
            }

            var deleted = 0;
            var failed = 0;

            foreach (var userId in expiredUsers)
            {
                try
                {
                    await _authClient.AdminDeleteUser(userId);
                    _logger.LogInformation("Scheduled account deleted {UserId}", userId);
                    deleted++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to delete scheduled account {UserId}", userId);
                    failed++;
                }
            }

            _logger.LogInformation(
                "Scheduled deletion cleanup completed: {Deleted} deleted, {Failed} failed, duration {Duration}ms",
                deleted, failed, (DateTimeOffset.UtcNow - startTime).TotalMilliseconds);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Scheduled account deletion cleanup failed");
        }
    }

    private async Task<List<string>> FindExpiredScheduledUsers(DateTimeOffset now)
    {
        var expired = new List<string>();
        var page = 1;

        while (page <= MaxPages)
        {
            var pageData = await _authClient.AdminListUsers<AdminUsersPage>(page, PerPage);
            if (pageData is null) break;

            var users = pageData.Users ?? new List<AdminUser>();

            foreach (var user in users)
            {
                var scheduledAt = user.UserMetadata?.ScheduledDeletionAt;
                if (string.IsNullOrEmpty(scheduledAt)) continue;

                if (!DateTimeOffset.TryParse(scheduledAt, out var scheduledDate))
                {
                    _logger.LogWarning("Invalid scheduledDeletionAt for user {UserId}: {Value}", user.Id, scheduledAt);
                    continue;
                }

                var expirationDate = scheduledDate.AddDays(GracePeriodDays);
                if (now >= expirationDate)
                    expired.Add(user.Id);
            }

            if (users.Count < PerPage) break;
            page++;
        }

        _logger.LogInformation("Found {Count} expired scheduled deletions", expired.Count);
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
        public AdminUserMetadata? UserMetadata { get; set; }
    }

    private sealed class AdminUserMetadata
    {
        public string? ScheduledDeletionAt { get; set; }
    }
}
