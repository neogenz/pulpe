using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Pulpe.Infrastructure.Services.AccountDeletion;
using Pulpe.Infrastructure.Supabase;
using Pulpe.Api.Tests.Integration.Fixtures;

namespace Pulpe.Api.Tests.Integration;

/// <summary>
/// Integration tests for account deletion grace period logic against real local Supabase.
/// </summary>
[Trait("Category", "Integration")]
public sealed class AccountDeletionIntegrationTests : IAsyncLifetime
{
    private readonly SupabaseFixture _fixture = new();
    private AccountDeletionService _sut = null!;
    private SupabaseAuthClient _authClient = null!;

    public async Task InitializeAsync()
    {
        await _fixture.InitializeAsync();

        if (!_fixture.IsAvailable)
            return; // Tests will skip themselves via SkipIfUnavailable()

        var supabaseOptions = Options.Create(new SupabaseOptions
        {
            Url = _fixture.SupabaseUrl,
            AnonKey = _fixture.AnonKey,
            ServiceRoleKey = _fixture.ServiceRoleKey
        });

        var httpClientFactory = new SimpleHttpClientFactory();
        _authClient = new SupabaseAuthClient(supabaseOptions, httpClientFactory);
        _sut = new AccountDeletionService(_authClient, NullLogger<AccountDeletionService>.Instance);
    }

    public Task DisposeAsync() => _fixture.DisposeAsync();

    // --- Grace period: user scheduled for deletion in future is NOT deleted ---

    [Fact]
    public async Task CleanupScheduledDeletions_UserScheduledInFuture_NotDeleted()
    {
        _fixture.SkipIfUnavailable();
        var user = await _fixture.CreateTestUser();

        await _authClient.AdminUpdateUser<object>(user.Id, new
        {
            user_metadata = new { scheduled_deletion_at = DateTimeOffset.UtcNow.AddDays(10).ToString("O") }
        });

        await _sut.CleanupScheduledDeletions();

        // User should still exist
        var stillExists = await UserExists(user.Id);
        stillExists.Should().BeTrue("user scheduled for future deletion should not be deleted yet");

        // Manual cleanup
        await _fixture.AdminDeleteUser(user.Id);
    }

    // --- Grace period: user scheduled for deletion more than 3 days ago IS deleted ---

    [Fact]
    public async Task CleanupScheduledDeletions_UserScheduledPast3Days_IsDeleted()
    {
        _fixture.SkipIfUnavailable();
        var user = await _fixture.CreateTestUser();

        // Schedule deletion 4 days ago (grace period expired)
        await _authClient.AdminUpdateUser<object>(user.Id, new
        {
            user_metadata = new { scheduled_deletion_at = DateTimeOffset.UtcNow.AddDays(-4).ToString("O") }
        });

        await _sut.CleanupScheduledDeletions();

        var stillExists = await UserExists(user.Id);
        stillExists.Should().BeFalse("user past grace period should be deleted");
        // No manual cleanup needed — already deleted
    }

    // --- User without scheduled_deletion_at is not affected ---

    [Fact]
    public async Task CleanupScheduledDeletions_NormalUser_IsNotDeleted()
    {
        _fixture.SkipIfUnavailable();
        var user = await _fixture.CreateTestUser();

        await _sut.CleanupScheduledDeletions();

        var stillExists = await UserExists(user.Id);
        stillExists.Should().BeTrue("normal user should not be deleted");

        await _fixture.AdminDeleteUser(user.Id);
    }

    private async Task<bool> UserExists(string userId)
    {
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Get,
                $"{_fixture.SupabaseUrl}/auth/v1/admin/users/{userId}");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _fixture.ServiceRoleKey);
            request.Headers.Add("apikey", _fixture.ServiceRoleKey);

            using var response = await _fixture.HttpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}

/// <summary>Minimal IHttpClientFactory for integration tests.</summary>
internal sealed class SimpleHttpClientFactory : IHttpClientFactory
{
    public HttpClient CreateClient(string name) => new();
}
