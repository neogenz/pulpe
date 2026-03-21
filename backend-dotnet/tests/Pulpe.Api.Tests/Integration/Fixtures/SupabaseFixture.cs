using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pulpe.Api.Tests.Integration.Fixtures;

/// <summary>
/// Shared fixture that checks local Supabase reachability, creates/cleans up test users,
/// and exposes an authenticated HTTP client for integration tests.
/// </summary>
public sealed class SupabaseFixture : IAsyncLifetime
{
    private const string DefaultSupabaseUrl = "http://127.0.0.1:54321";
    private const string DefaultAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7kyqHDan_WiCIozr-8CB3DTQSmqAyCIWI54";
    private const string DefaultServiceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hj04zWl196z2-SBc0";

    public string SupabaseUrl { get; } = Environment.GetEnvironmentVariable("SUPABASE_URL") ?? DefaultSupabaseUrl;
    public string AnonKey { get; } = Environment.GetEnvironmentVariable("SUPABASE_ANON_KEY") ?? DefaultAnonKey;
    public string ServiceRoleKey { get; } = Environment.GetEnvironmentVariable("SUPABASE_SERVICE_ROLE_KEY") ?? DefaultServiceRoleKey;

    public bool IsAvailable { get; private set; }
    public HttpClient HttpClient { get; } = new();

    private readonly List<string> _createdUserIds = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public async Task InitializeAsync()
    {
        IsAvailable = await CheckReachability() && await CheckServiceRoleKey();

        if (!IsAvailable)
        {
            var isCI = Environment.GetEnvironmentVariable("CI") == "true";
            if (isCI)
                throw new InvalidOperationException(
                    "Supabase is not running but CI=true. Ensure local Supabase is started before running integration tests.");
            // Non-CI: skip gracefully — individual tests will call SkipIfUnavailable()
        }
    }

    public async Task DisposeAsync()
    {
        foreach (var userId in _createdUserIds)
        {
            try { await AdminDeleteUser(userId); }
            catch { /* best-effort cleanup */ }
        }
        HttpClient.Dispose();
    }

    /// <summary>
    /// Call this at the top of every integration test to skip if Supabase is not running.
    /// Throws Xunit.Sdk.SkipException which xUnit recognizes as a skip signal.
    /// </summary>
    public void SkipIfUnavailable()
    {
        if (!IsAvailable)
            throw Xunit.Sdk.SkipException.ForSkip("Supabase not running — skipping integration test.");
    }

    public async Task<TestUser> CreateTestUser(string? email = null, string? password = null)
    {
        var id = Guid.NewGuid().ToString("N")[..8];
        var resolvedEmail = email ?? $"test-{id}@pulpe-integration.test";
        var resolvedPassword = password ?? "Test1234!";

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{SupabaseUrl}/auth/v1/admin/users");
        AddServiceRoleHeaders(request);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new
            {
                email = resolvedEmail,
                password = resolvedPassword,
                email_confirm = true
            }, JsonOptions),
            Encoding.UTF8, "application/json");

        using var response = await HttpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Failed to create test user: {content}");

        var userData = JsonSerializer.Deserialize<AdminUserResponse>(content, JsonOptions)
            ?? throw new InvalidOperationException("Failed to parse user response");

        _createdUserIds.Add(userData.Id);

        // Sign in to get access token
        var accessToken = await SignIn(resolvedEmail, resolvedPassword);

        return new TestUser(userData.Id, resolvedEmail, resolvedPassword, accessToken);
    }

    public async Task<string> SignIn(string email, string password)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{SupabaseUrl}/auth/v1/token?grant_type=password");
        request.Headers.Add("apikey", AnonKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { email, password }, JsonOptions),
            Encoding.UTF8, "application/json");

        using var response = await HttpClient.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Sign-in failed: {content}");

        var tokenData = JsonSerializer.Deserialize<TokenResponse>(content, JsonOptions)
            ?? throw new InvalidOperationException("Failed to parse token response");

        return tokenData.AccessToken;
    }

    public async Task AdminDeleteUser(string userId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete,
            $"{SupabaseUrl}/auth/v1/admin/users/{userId}");
        AddServiceRoleHeaders(request);
        await HttpClient.SendAsync(request);
    }

    public async Task DeleteEncryptionKey(string userId)
    {
        // Direct REST delete via PostgREST service role
        using var request = new HttpRequestMessage(HttpMethod.Delete,
            $"{SupabaseUrl}/rest/v1/user_encryption_key?user_id=eq.{userId}");
        request.Headers.Add("apikey", ServiceRoleKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ServiceRoleKey);
        request.Headers.Add("Prefer", "return=minimal");
        await HttpClient.SendAsync(request);
    }

    private async Task<bool> CheckReachability()
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{SupabaseUrl}/auth/v1/health");
            request.Headers.Add("apikey", AnonKey);
            using var response = await HttpClient.SendAsync(request, cts.Token);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Verifies the service role key is valid by hitting the admin users list endpoint.</summary>
    private async Task<bool> CheckServiceRoleKey()
    {
        try
        {
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            using var request = new HttpRequestMessage(HttpMethod.Get, $"{SupabaseUrl}/auth/v1/admin/users?page=1&per_page=1");
            AddServiceRoleHeaders(request);
            using var response = await HttpClient.SendAsync(request, cts.Token);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private void AddServiceRoleHeaders(HttpRequestMessage request)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", ServiceRoleKey);
        request.Headers.Add("apikey", ServiceRoleKey);
    }

    private sealed class AdminUserResponse
    {
        public string Id { get; set; } = string.Empty;
        public string? Email { get; set; }
    }

    private sealed class TokenResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public string TokenType { get; set; } = string.Empty;
    }
}

public sealed record TestUser(string Id, string Email, string Password, string AccessToken);
