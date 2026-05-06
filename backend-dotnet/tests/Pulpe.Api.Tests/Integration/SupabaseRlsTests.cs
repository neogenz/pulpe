using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using Pulpe.Api.Tests.Integration.Fixtures;

namespace Pulpe.Api.Tests.Integration;

/// <summary>
/// RLS integration tests verifying that PostgREST enforces row-level security.
/// User A's rows must not be visible or mutable by user B's JWT.
/// Requires local Supabase — skipped automatically when not running.
/// </summary>
[Trait("Category", "Integration")]
public sealed class SupabaseRlsTests : IAsyncLifetime
{
    private readonly SupabaseFixture _fixture = new();

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        PropertyNameCaseInsensitive = true
    };

    public Task InitializeAsync() => _fixture.InitializeAsync();
    public Task DisposeAsync() => _fixture.DisposeAsync();

    // --- Budget isolation ---

    [Fact]
    public async Task Budget_UserBCannotReadUserABudget()
    {
        _fixture.SkipIfUnavailable();

        var userA = await _fixture.CreateTestUser();
        var userB = await _fixture.CreateTestUser();

        // User A creates a budget via PostgREST
        var budgetId = await CreateBudgetAsUser(userA);
        budgetId.Should().NotBeEmpty("user A should be able to create a budget");

        // User B attempts to read user A's budget by ID
        var rows = await FetchBudgetsByUserJwt(userB.AccessToken, budgetId);

        rows.Should().BeEmpty("RLS must prevent user B from reading user A's budget");
    }

    [Fact]
    public async Task Budget_UserACanReadOwnBudget()
    {
        _fixture.SkipIfUnavailable();

        var userA = await _fixture.CreateTestUser();

        var budgetId = await CreateBudgetAsUser(userA);
        budgetId.Should().NotBeEmpty();

        var rows = await FetchBudgetsByUserJwt(userA.AccessToken, budgetId);

        rows.Should().HaveCount(1, "user A must be able to read their own budget");
    }

    // --- Helpers ---

    private async Task<string> CreateBudgetAsUser(TestUser user)
    {
        var payload = new
        {
            user_id = user.Id,
            month = 1,
            year = 2025,
            description = "rls-test-budget"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_fixture.SupabaseUrl}/rest/v1/budgets");
        AddUserHeaders(request, user.AccessToken);
        request.Headers.Add("Prefer", "return=representation");
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload, JsonOptions),
            Encoding.UTF8, "application/json");

        using var response = await _fixture.HttpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
            return string.Empty;

        var content = await response.Content.ReadAsStringAsync();
        var rows = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content, JsonOptions) ?? [];

        return rows.Count > 0 && rows[0].TryGetValue("id", out var idEl)
            ? idEl.GetString() ?? string.Empty
            : string.Empty;
    }

    private async Task<List<Dictionary<string, JsonElement>>> FetchBudgetsByUserJwt(
        string accessToken, string budgetId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"{_fixture.SupabaseUrl}/rest/v1/budgets?id=eq.{budgetId}");
        AddUserHeaders(request, accessToken);

        using var response = await _fixture.HttpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
            return [];

        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content, JsonOptions) ?? [];
    }

    private void AddUserHeaders(HttpRequestMessage request, string accessToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("apikey", _fixture.AnonKey);
    }
}
