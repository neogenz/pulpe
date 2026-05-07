using Pulpe.Application.Demo;

namespace Pulpe.Api.HostedServices;

public sealed class DemoCleanupHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DemoCleanupHostedService> _logger;

    public DemoCleanupHostedService(IServiceScopeFactory scopeFactory, ILogger<DemoCleanupHostedService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(6));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            using var scope = _scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<DemoCleanupService>();
            try
            {
                await service.CleanupExpiredDemoUsers();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Demo cleanup failed");
            }
        }
    }
}
