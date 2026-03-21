using System.Text.Json;

namespace Pulpe.Api.Api.Middleware;

public class MaintenanceMiddleware
{
    private readonly RequestDelegate _next;
    private readonly bool _isMaintenanceMode;

    private static readonly HashSet<string> ExemptPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/health",
        "/",
        "/api/v1/maintenance/status"
    };

    public MaintenanceMiddleware(RequestDelegate next)
    {
        _next = next;
        _isMaintenanceMode = string.Equals(
            Environment.GetEnvironmentVariable("MAINTENANCE_MODE"),
            "true",
            StringComparison.OrdinalIgnoreCase);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (_isMaintenanceMode && !ExemptPaths.Contains(context.Request.Path))
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { code = "MAINTENANCE" }));
            return;
        }

        await _next(context);
    }
}
