using System.Net;
using System.Text.Json;

namespace Pulpe.Api.Api.Middleware;

public class IpBlacklistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly HashSet<string> _blacklistedIps;

    public IpBlacklistMiddleware(RequestDelegate next)
    {
        _next = next;
        var raw = Environment.GetEnvironmentVariable("IP_BLACKLIST") ?? string.Empty;
        _blacklistedIps = raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToHashSet();
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var ip = GetClientIp(context);

        if (ip is not null && _blacklistedIps.Contains(ip))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { code = "IP_BLOCKED" }));
            return;
        }

        await _next(context);
    }

    private static string? GetClientIp(HttpContext context)
    {
        var forwarded = context.Request.Headers["X-Forwarded-For"].ToString();
        if (!string.IsNullOrEmpty(forwarded))
            return forwarded.Split(',')[0].Trim();

        var realIp = context.Request.Headers["X-Real-IP"].ToString();
        if (!string.IsNullOrEmpty(realIp))
            return realIp;

        return context.Connection.RemoteIpAddress?.ToString();
    }
}
