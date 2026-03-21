using System.Text;
using System.Text.Json;

namespace Pulpe.Api.Infrastructure.Turnstile;

public interface ITurnstileService
{
    Task<bool> Verify(string token, string? ip = null);
}

public sealed class TurnstileService : ITurnstileService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<TurnstileService> _logger;
    private readonly string _secretKey;
    private readonly bool _isProduction;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public TurnstileService(IHttpClientFactory httpClientFactory, ILogger<TurnstileService> logger, IConfiguration configuration)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _secretKey = configuration["TURNSTILE_SECRET_KEY"] ?? string.Empty;

        var env = configuration["ASPNETCORE_ENVIRONMENT"] ?? "Development";
        _isProduction = string.Equals(env, "Production", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<bool> Verify(string token, string? ip = null)
    {
        if (!_isProduction)
        {
            _logger.LogDebug("Turnstile verification skipped (non-production)");
            return true;
        }

        if (string.IsNullOrEmpty(_secretKey))
        {
            _logger.LogWarning("TURNSTILE_SECRET_KEY not configured");
            return false;
        }

        try
        {
            using var client = _httpClientFactory.CreateClient();
            var payload = JsonSerializer.Serialize(new
            {
                secret = _secretKey,
                response = token,
                remoteip = ip
            }, JsonOptions);

            using var content = new StringContent(payload, Encoding.UTF8, "application/json");
            using var response = await client.PostAsync(
                "https://challenges.cloudflare.com/turnstile/v0/siteverify", content);

            var body = await response.Content.ReadAsStringAsync();
            var result = JsonSerializer.Deserialize<TurnstileVerifyResponse>(body, JsonOptions);

            if (result?.Success == true)
            {
                _logger.LogInformation("Turnstile verification successful for hostname {Hostname}", result.Hostname);
                return true;
            }

            _logger.LogWarning("Turnstile verification failed with error codes: {ErrorCodes}",
                result?.ErrorCodes != null ? string.Join(", ", result.ErrorCodes) : "unknown");
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Turnstile verification error");
            return false;
        }
    }

    private sealed record TurnstileVerifyResponse(
        bool Success,
        string? Hostname,
        string[]? ErrorCodes);
}
