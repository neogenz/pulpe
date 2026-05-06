using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace Pulpe.Infrastructure.Supabase;

public sealed class SupabaseAuthClient
{
    private readonly SupabaseOptions _options;
    private readonly IHttpClientFactory _httpClientFactory;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public SupabaseAuthClient(IOptions<SupabaseOptions> options, IHttpClientFactory httpClientFactory)
    {
        _options = options.Value;
        _httpClientFactory = httpClientFactory;
    }

    public async Task<T?> GetUser<T>(string accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.Url}/auth/v1/user");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("apikey", _options.AnonKey);
        return await Send<T>(request);
    }

    public async Task<T?> AdminGetUser<T>(string userId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"{_options.Url}/auth/v1/admin/users/{userId}");
        AddServiceRoleHeaders(request);
        return await Send<T>(request);
    }

    public async Task<T?> AdminUpdateUser<T>(string userId, object metadata)
    {
        using var request = new HttpRequestMessage(HttpMethod.Put, $"{_options.Url}/auth/v1/admin/users/{userId}");
        AddServiceRoleHeaders(request);
        request.Content = new StringContent(JsonSerializer.Serialize(metadata, JsonOptions), Encoding.UTF8, "application/json");
        return await Send<T>(request);
    }

    public async Task AdminDeleteUser(string userId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"{_options.Url}/auth/v1/admin/users/{userId}");
        AddServiceRoleHeaders(request);
        using var client = _httpClientFactory.CreateClient("supabase");
        await client.SendAsync(request);
    }

    public async Task<T?> AdminListUsers<T>(int page = 1, int perPage = 50)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"{_options.Url}/auth/v1/admin/users?page={page}&per_page={perPage}");
        AddServiceRoleHeaders(request);
        return await Send<T>(request);
    }

    public async Task AdminSignOut(string token, string scope = "global")
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.Url}/auth/v1/admin/signout");
        AddServiceRoleHeaders(request);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { token, scope }, JsonOptions),
            Encoding.UTF8, "application/json");
        using var client = _httpClientFactory.CreateClient("supabase");
        await client.SendAsync(request);
    }

    public async Task<T?> SignInWithPassword<T>(string email, string password)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_options.Url}/auth/v1/token?grant_type=password");
        request.Headers.Add("apikey", _options.AnonKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { email, password }, JsonOptions),
            Encoding.UTF8, "application/json");
        return await Send<T>(request);
    }

    public async Task<T?> AdminCreateUser<T>(object data)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_options.Url}/auth/v1/admin/users");
        AddServiceRoleHeaders(request);
        request.Content = new StringContent(JsonSerializer.Serialize(data, JsonOptions), Encoding.UTF8, "application/json");
        return await Send<T>(request);
    }

    private void AddServiceRoleHeaders(HttpRequestMessage request)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ServiceRoleKey);
        request.Headers.Add("apikey", _options.ServiceRoleKey);
    }

    private async Task<T?> Send<T>(HttpRequestMessage request)
    {
        using var client = _httpClientFactory.CreateClient("supabase");
        using var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode || string.IsNullOrWhiteSpace(content))
            return default;

        try { return JsonSerializer.Deserialize<T>(content, JsonOptions); }
        catch { return default; }
    }
}
