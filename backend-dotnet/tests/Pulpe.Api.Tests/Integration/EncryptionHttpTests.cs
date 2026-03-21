using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Pulpe.Api.Domain.User;
using Pulpe.Api.Tests.Integration.Fixtures;

namespace Pulpe.Api.Tests.Integration;

/// <summary>
/// HTTP pipeline integration tests for all encryption endpoints.
/// Uses WebApplicationFactory with mocked auth and fake encryption service.
/// No real Supabase required.
/// </summary>
[Trait("Category", "Integration")]
public sealed class EncryptionHttpTests : IClassFixture<TestWebAppFactory>
{
    private readonly TestWebAppFactory _factory;

    private static readonly AuthenticatedUser TestUser = new()
    {
        Id = "test-user-id",
        Email = "test@example.com",
        AccessToken = "test-access-token",
        ClientKey = new byte[32] { 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
                                   17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 }
    };

    private const string ValidClientKeyHex = "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20";

    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public EncryptionHttpTests(TestWebAppFactory factory)
    {
        _factory = factory;
    }

    // --- Unauthenticated requests ---

    [Fact]
    public async Task GetVaultStatus_Unauthenticated_Returns401()
    {
        _factory.CurrentUser = null;
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/encryption/vault-status");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetSalt_Unauthenticated_Returns401()
    {
        _factory.CurrentUser = null;
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/encryption/salt");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // --- GET /api/v1/encryption/vault-status ---

    [Fact]
    public async Task GetVaultStatus_Authenticated_Returns200WithShape()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.GetAsync("/api/v1/encryption/vault-status");
        var data = await ReadWrapped<VaultStatusData>(response);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        data.Should().NotBeNull();
        data!.PinCodeConfigured.Should().BeFalse();
        data.RecoveryKeyConfigured.Should().BeFalse();
        data.VaultCodeConfigured.Should().BeFalse();
    }

    // --- GET /api/v1/encryption/salt ---

    [Fact]
    public async Task GetSalt_Authenticated_Returns200WithShape()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.GetAsync("/api/v1/encryption/salt");
        var data = await ReadWrapped<SaltData>(response);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        data.Should().NotBeNull();
        data!.Salt.Should().NotBeNullOrEmpty();
        data.KdfIterations.Should().BeGreaterThan(0);
    }

    // --- POST /api/v1/encryption/validate-key ---

    [Fact]
    public async Task ValidateKey_ValidHex_Returns204()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.PostAsJsonAsync("/api/v1/encryption/validate-key",
            new { clientKey = ValidClientKeyHex });

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    // --- POST /api/v1/encryption/setup-recovery ---

    [Fact]
    public async Task SetupRecovery_WithClientKey_Returns201WithRecoveryKey()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser, ValidClientKeyHex);

        var response = await client.PostAsync("/api/v1/encryption/setup-recovery", null);
        var data = await ReadWrapped<RecoveryKeyData>(response);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        data.Should().NotBeNull();
        data!.RecoveryKey.Should().NotBeNullOrEmpty();
    }

    // --- POST /api/v1/encryption/regenerate-recovery ---

    [Fact]
    public async Task RegenerateRecovery_WithClientKey_Returns201WithRecoveryKey()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser, ValidClientKeyHex);

        var response = await client.PostAsync("/api/v1/encryption/regenerate-recovery", null);
        var data = await ReadWrapped<RecoveryKeyData>(response);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        data.Should().NotBeNull();
        data!.RecoveryKey.Should().NotBeNullOrEmpty();
    }

    // --- POST /api/v1/encryption/recover ---

    [Fact]
    public async Task Recover_ValidBody_Returns200()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.PostAsJsonAsync("/api/v1/encryption/recover", new
        {
            recoveryKey = "AAAA-BBBB-CCCC-DDDD",
            newClientKey = ValidClientKeyHex
        });

        // FakeEncryptionAppService returns { Success = true } — ResponseWrapper skips it
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Recover_InvalidJson_Returns400()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.PostAsync("/api/v1/encryption/recover",
            new StringContent("not-json", System.Text.Encoding.UTF8, "application/json"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // --- POST /api/v1/encryption/change-pin ---

    [Fact]
    public async Task ChangePin_ValidBody_Returns200()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.PostAsJsonAsync("/api/v1/encryption/change-pin", new
        {
            oldClientKey = "0000000000000000000000000000000000000000000000000000000000000001",
            newClientKey = ValidClientKeyHex
        });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ChangePin_InvalidJson_Returns400()
    {
        var client = _factory.CreateAuthenticatedClient(TestUser);

        var response = await client.PostAsync("/api/v1/encryption/change-pin",
            new StringContent("not-json", System.Text.Encoding.UTF8, "application/json"));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // --- Helpers ---

    /// <summary>
    /// Reads the nested data from the wrapped response format: { success, data: T, ... }
    /// </summary>
    private static async Task<T?> ReadWrapped<T>(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("data", out var dataProp))
            return default;
        return dataProp.Deserialize<T>(JsonOpts);
    }

    private sealed class VaultStatusData
    {
        public bool PinCodeConfigured { get; init; }
        public bool RecoveryKeyConfigured { get; init; }
        public bool VaultCodeConfigured { get; init; }
    }

    private sealed class SaltData
    {
        public string Salt { get; init; } = string.Empty;
        public int KdfIterations { get; init; }
        public bool HasRecoveryKey { get; init; }
    }

    private sealed class RecoveryKeyData
    {
        public string RecoveryKey { get; init; } = string.Empty;
    }
}
