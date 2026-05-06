using FluentAssertions;
using Pulpe.Domain.Common;

namespace Pulpe.Api.Tests.Application.AccountDeletion;

/// <summary>
/// Tests the 3-day grace period logic in AccountDeletionService.
/// We test the domain rule inline since the service uses internal private types.
/// </summary>
public class AccountDeletionGracePeriodTests
{
    private const int GracePeriodDays = 3;

    private static bool IsExpired(string scheduledAt, DateTimeOffset now)
    {
        if (!DateTimeOffset.TryParse(scheduledAt, out var scheduledDate))
            return false;
        return now >= scheduledDate.AddDays(GracePeriodDays);
    }

    [Fact]
    public void GracePeriod_ScheduledExactly3DaysAgo_IsExpired()
    {
        var now = DateTimeOffset.UtcNow;
        var scheduledAt = now.AddDays(-3).ToString("O");

        IsExpired(scheduledAt, now).Should().BeTrue();
    }

    [Fact]
    public void GracePeriod_ScheduledLessThan3DaysAgo_IsNotExpired()
    {
        var now = DateTimeOffset.UtcNow;
        var scheduledAt = now.AddDays(-2).AddHours(-23).ToString("O");

        IsExpired(scheduledAt, now).Should().BeFalse();
    }

    [Fact]
    public void GracePeriod_ScheduledMoreThan3DaysAgo_IsExpired()
    {
        var now = DateTimeOffset.UtcNow;
        var scheduledAt = now.AddDays(-10).ToString("O");

        IsExpired(scheduledAt, now).Should().BeTrue();
    }

    [Fact]
    public void GracePeriod_InvalidDateString_ReturnsFalse()
    {
        var now = DateTimeOffset.UtcNow;
        IsExpired("not-a-date", now).Should().BeFalse();
    }

    [Fact]
    public void GracePeriod_EmptyString_ReturnsFalse()
    {
        var now = DateTimeOffset.UtcNow;
        IsExpired(string.Empty, now).Should().BeFalse();
    }

    [Fact]
    public void GracePeriod_ScheduledJustNow_IsNotExpired()
    {
        var now = DateTimeOffset.UtcNow;
        var scheduledAt = now.ToString("O");

        IsExpired(scheduledAt, now).Should().BeFalse();
    }
}
