using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Pulpe.Infrastructure.Supabase;

public sealed class SupabaseRestClient
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private readonly string _token;
    private readonly string _anonKey;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower) }
    };

    internal SupabaseRestClient(HttpClient httpClient, string baseUrl, string token, string anonKey)
    {
        _httpClient = httpClient;
        _baseUrl = baseUrl.TrimEnd('/');
        _token = token;
        _anonKey = anonKey;
    }

    public SupabaseQueryBuilder From(string table)
    {
        var headers = BuildHeaders();
        return new SupabaseQueryBuilder(_baseUrl, table, headers);
    }

    public async Task<SupabaseResponse<T>> Execute<T>(SupabaseQueryBuilder builder)
    {
        var (url, method, headers, body) = builder.Build();

        using var request = new HttpRequestMessage(new HttpMethod(method), url);
        foreach (var (key, value) in headers)
            request.Headers.TryAddWithoutValidation(key, value);

        if (body is not null)
            request.Content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            SupabaseError? error = null;
            try { error = JsonSerializer.Deserialize<SupabaseError>(content, JsonOptions); }
            catch { error = new SupabaseError { Message = content }; }
            return new SupabaseResponse<T> { Error = error };
        }

        if (string.IsNullOrWhiteSpace(content) || content == "null")
            return new SupabaseResponse<T> { Data = default };

        try
        {
            var data = JsonSerializer.Deserialize<T>(content, JsonOptions);
            return new SupabaseResponse<T> { Data = data };
        }
        catch (JsonException ex)
        {
            return new SupabaseResponse<T>
            {
                Error = new SupabaseError { Message = $"Deserialization error: {ex.Message}" }
            };
        }
    }

    public async Task<SupabaseResponse<T>> Rpc<T>(string function, object? args = null)
    {
        var url = $"{_baseUrl}/rest/v1/rpc/{function}";
        using var request = new HttpRequestMessage(HttpMethod.Post, url);

        var headers = BuildHeaders();
        foreach (var (key, value) in headers)
            request.Headers.TryAddWithoutValidation(key, value);

        var body = args is not null
            ? JsonSerializer.Serialize(args, JsonOptions)
            : "{}";
        request.Content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            SupabaseError? error = null;
            try { error = JsonSerializer.Deserialize<SupabaseError>(content, JsonOptions); }
            catch { error = new SupabaseError { Message = content }; }
            return new SupabaseResponse<T> { Error = error };
        }

        if (string.IsNullOrWhiteSpace(content) || content == "null")
            return new SupabaseResponse<T> { Data = default };

        try
        {
            var data = JsonSerializer.Deserialize<T>(content, JsonOptions);
            return new SupabaseResponse<T> { Data = data };
        }
        catch (JsonException ex)
        {
            return new SupabaseResponse<T>
            {
                Error = new SupabaseError { Message = $"Deserialization error: {ex.Message}" }
            };
        }
    }

    private Dictionary<string, string> BuildHeaders() => new()
    {
        ["Authorization"] = $"Bearer {_token}",
        ["apikey"] = _anonKey,
        ["Content-Type"] = "application/json"
    };
}
