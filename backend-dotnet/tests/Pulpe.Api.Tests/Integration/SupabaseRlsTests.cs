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

    // --- Budget list isolation ---

    [Fact]
    public async Task Budget_ListAll_UserBSeesOnlyOwnBudgets()
    {
        _fixture.SkipIfUnavailable();

        var userA = await _fixture.CreateTestUser();
        var userB = await _fixture.CreateTestUser();

        // A creates 2 budgets; B creates 1
        await CreateBudgetAsUser(userA, month: 1);
        await CreateBudgetAsUser(userA, month: 2);
        var bBudgetId = await CreateBudgetAsUser(userB, month: 1);
        bBudgetId.Should().NotBeEmpty();

        // B lists all budgets — should only see their own
        var rows = await FetchAllBudgetsByUserJwt(userB.AccessToken);
        rows.Should().HaveCount(1, "User B should only see their own budget");
        rows[0].TryGetValue("id", out var idEl).Should().BeTrue();
        idEl.GetString().Should().Be(bBudgetId);
    }

    // --- Budget INSERT cross-user RLS ---

    [Fact]
    public async Task Budget_UserBCannotInsertWithUserAId_RlsRejects()
    {
        _fixture.SkipIfUnavailable();

        var userA = await _fixture.CreateTestUser();
        var userB = await _fixture.CreateTestUser();

        // B tries to INSERT a budget with A's user_id
        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget");
        AddUserHeaders(request, userB.AccessToken);
        request.Headers.Add("Prefer", "return=representation");
        request.Content = new StringContent(
            JsonSerializer.Serialize(new
            {
                user_id = userA.Id,
                month = 3,
                year = 2025,
                description = "rls-injection-attempt"
            }, JsonOptions),
            Encoding.UTF8, "application/json");

        using var response = await _fixture.HttpClient.SendAsync(request);

        // RLS must reject: either 401/403 or empty result
        if (response.IsSuccessStatusCode)
        {
            var content = await response.Content.ReadAsStringAsync();
            var rows = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content, JsonOptions) ?? [];
            rows.Should().BeEmpty("RLS must not allow inserting with another user's ID");
        }
        else
        {
            ((int)response.StatusCode).Should().BeGreaterThanOrEqualTo(400, "RLS should reject with an error status");
        }
    }

    // --- Budget UPDATE cross-user RLS ---

    [Fact]
    public async Task Budget_UserBCannotUpdateUserABudget_RlsRejects()
    {
        _fixture.SkipIfUnavailable();

        var userA = await _fixture.CreateTestUser();
        var userB = await _fixture.CreateTestUser();

        var aBudgetId = await CreateBudgetAsUser(userA);
        aBudgetId.Should().NotBeEmpty();

        // B attempts to UPDATE A's budget
        using var request = new HttpRequestMessage(HttpMethod.Patch,
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget?id=eq.{aBudgetId}");
        AddUserHeaders(request, userB.AccessToken);
        request.Headers.Add("Prefer", "return=representation");
        request.Content = new StringContent(
            JsonSerializer.Serialize(new { description = "hacked-by-b" }, JsonOptions),
            Encoding.UTF8, "application/json");

        using var response = await _fixture.HttpClient.SendAsync(request);

        // RLS returns 200 with empty array (no rows matched)
        var rows = response.IsSuccessStatusCode
            ? JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(
                await response.Content.ReadAsStringAsync(), JsonOptions) ?? []
            : [];

        rows.Should().BeEmpty("RLS must prevent B from updating A's budget");

        // Verify A's budget is unchanged via service-role read
        var unchanged = await FetchBudgetServiceRole(aBudgetId);
        unchanged.TryGetValue("description", out var descEl).Should().BeTrue();
        descEl.GetString().Should().Be("rls-test-budget", "A's budget description must be unchanged");
    }

    // --- Budget DELETE cross-user RLS ---

    [Fact]
    public async Task Budget_UserBCannotDeleteUserABudget_RlsRejects()
    {
        _fixture.SkipIfUnavailable();

        var userA = await _fixture.CreateTestUser();
        var userB = await _fixture.CreateTestUser();

        var aBudgetId = await CreateBudgetAsUser(userA);
        aBudgetId.Should().NotBeEmpty();

        // B attempts to DELETE A's budget
        using var request = new HttpRequestMessage(HttpMethod.Delete,
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget?id=eq.{aBudgetId}");
        AddUserHeaders(request, userB.AccessToken);

        using var response = await _fixture.HttpClient.SendAsync(request);

        // Verify A's budget still exists via service-role read
        var stillExists = await FetchBudgetServiceRole(aBudgetId);
        stillExists.Should().NotBeNull("A's budget must still exist after B's delete attempt");
    }

    // --- Helpers ---

    private async Task<string> CreateBudgetAsUser(TestUser user, int month = 1)
    {
        var payload = new
        {
            user_id = user.Id,
            month,
            year = 2025,
            description = "rls-test-budget"
        };

        using var request = new HttpRequestMessage(HttpMethod.Post,
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget");
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
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget?id=eq.{budgetId}");
        AddUserHeaders(request, accessToken);

        using var response = await _fixture.HttpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
            return [];

        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content, JsonOptions) ?? [];
    }

    private async Task<List<Dictionary<string, JsonElement>>> FetchAllBudgetsByUserJwt(string accessToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget");
        AddUserHeaders(request, accessToken);

        using var response = await _fixture.HttpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
            return [];

        var content = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content, JsonOptions) ?? [];
    }

    private async Task<Dictionary<string, JsonElement>?> FetchBudgetServiceRole(string budgetId)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get,
            $"{_fixture.SupabaseUrl}/rest/v1/monthly_budget?id=eq.{budgetId}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _fixture.ServiceRoleKey);
        request.Headers.Add("apikey", _fixture.ServiceRoleKey);

        using var response = await _fixture.HttpClient.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            return null;

        var content = await response.Content.ReadAsStringAsync();
        var rows = JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(content, JsonOptions) ?? [];
        return rows.Count > 0 ? rows[0] : null;
    }

    private void AddUserHeaders(HttpRequestMessage request, string accessToken)
    {
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        request.Headers.Add("apikey", _fixture.AnonKey);
    }
}
