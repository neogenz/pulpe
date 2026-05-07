using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;
using Pulpe.Application.Common;
using Supabase.Postgrest;

namespace Pulpe.Infrastructure.Supabase;

public sealed class SupabaseClientFactory : ISupabaseClientFactory
{
    private readonly SupabaseOptions _options;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public SupabaseClientFactory(IOptions<SupabaseOptions> options, IHttpContextAccessor httpContextAccessor)
    {
        _options = options.Value;
        _httpContextAccessor = httpContextAccessor;
    }

    public Client CreateAdminClient()
    {
        var restUrl = $"{_options.Url.TrimEnd('/')}/rest/v1";
        var clientOptions = new ClientOptions
        {
            Headers = new Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {_options.ServiceRoleKey}",
                ["apikey"] = _options.ServiceRoleKey
            }
        };
        return new Client(restUrl, clientOptions);
    }

    public Client CreateUserClient()
    {
        var jwt = ExtractBearerToken()
            ?? throw new InvalidOperationException("Cannot create user client without a request JWT");

        var restUrl = $"{_options.Url.TrimEnd('/')}/rest/v1";
        var clientOptions = new ClientOptions
        {
            Headers = new Dictionary<string, string>
            {
                ["Authorization"] = $"Bearer {jwt}",
                ["apikey"] = _options.AnonKey
            }
        };
        return new Client(restUrl, clientOptions);
    }

    private string? ExtractBearerToken()
    {
        var authHeader = _httpContextAccessor.HttpContext?.Request.Headers["Authorization"].ToString();
        if (string.IsNullOrEmpty(authHeader)) return null;
        return authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader[7..]
            : authHeader;
    }
}
