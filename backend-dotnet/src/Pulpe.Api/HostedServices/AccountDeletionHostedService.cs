using Pulpe.Api.Application.AccountDeletion;

namespace Pulpe.Api.HostedServices;

public sealed class AccountDeletionHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<AccountDeletionHostedService> _logger;

    public AccountDeletionHostedService(IServiceScopeFactory scopeFactory, ILogger<AccountDeletionHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await WaitUntilNextTwoAmUtc(stoppingToken);

        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<AccountDeletionService>();
            try
            {
                await service.CleanupScheduledDeletions();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Account deletion cleanup failed");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    private static async Task WaitUntilNextTwoAmUtc(CancellationToken stoppingToken)
    {
        var now = DateTime.UtcNow;
        var nextRun = new DateTime(now.Year, now.Month, now.Day, 2, 0, 0, DateTimeKind.Utc);
        if (now >= nextRun)
            nextRun = nextRun.AddDays(1);

        var delay = nextRun - now;
        await Task.Delay(delay, stoppingToken);
    }
}
