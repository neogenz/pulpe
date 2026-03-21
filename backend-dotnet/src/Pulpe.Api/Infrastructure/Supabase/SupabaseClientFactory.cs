using Microsoft.Extensions.Options;

namespace Pulpe.Api.Infrastructure.Supabase;

public sealed class SupabaseClientFactory
{
    private readonly SupabaseOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;
    private SupabaseRestClient? _serviceRoleClient;
    private SupabaseRestClient? _anonymousClient;

    public SupabaseClientFactory(IOptions<SupabaseOptions> options, IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
    }

    public SupabaseRestClient CreateAuthenticated(string accessToken)
    {
        var httpClient = _httpClientFactory.CreateClient("supabase");
        return new SupabaseRestClient(httpClient, _options.Url, accessToken, _options.AnonKey);
    }

    public SupabaseRestClient GetServiceRole()
    {
        if (_serviceRoleClient is not null)
            return _serviceRoleClient;

        var httpClient = _httpClientFactory.CreateClient("supabase");
        _serviceRoleClient = new SupabaseRestClient(httpClient, _options.Url, _options.ServiceRoleKey, _options.AnonKey);
        return _serviceRoleClient;
    }

    public SupabaseRestClient GetAnonymous()
    {
        if (_anonymousClient is not null)
            return _anonymousClient;

        var httpClient = _httpClientFactory.CreateClient("supabase");
        _anonymousClient = new SupabaseRestClient(httpClient, _options.Url, _options.AnonKey, _options.AnonKey);
        return _anonymousClient;
    }
}
