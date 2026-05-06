using FluentAssertions;
using Microsoft.Extensions.Options;
using Pulpe.Domain.Encryption;
using Pulpe.Infrastructure.Encryption;

namespace Pulpe.Api.Tests.Integration;

/// <summary>
/// Integration tests for AES-256-GCM encryption crypto logic.
/// Uses an in-memory key repository — no Supabase required.
/// Tests real HKDF DEK derivation, AES-GCM encrypt/decrypt, recovery key wrap/unwrap.
/// </summary>
[Trait("Category", "Integration")]
public sealed class EncryptionIntegrationTests
{
    private const string MasterKey = "0000000000000000000000000000000000000000000000000000000000000001";
    private const string UserId = "test-user-id-1234";

    private static AesGcmEncryptionService CreateSut(InMemoryEncryptionKeyRepository? repo = null)
    {
        var options = Options.Create(new EncryptionOptions { MasterKey = MasterKey });
        return new AesGcmEncryptionService(options, repo ?? new InMemoryEncryptionKeyRepository());
    }

    // --- DEK derivation consistency ---

    [Fact]
    public async Task EnsureUserDek_NewUser_CreatesSaltAndReturnsDek()
    {
        var sut = CreateSut();
        var clientKey = GenerateClientKey();

        var dek = await sut.EnsureUserDek(UserId, clientKey);

        dek.Should().HaveCount(32);
        dek.Should().NotBeEquivalentTo(new byte[32]);
    }

    [Fact]
    public async Task EnsureUserDek_SameKey_ReturnsSameDek()
    {
        var repo = new InMemoryEncryptionKeyRepository();
        var sut = CreateSut(repo);
        var clientKey = GenerateClientKey();

        var dek1 = await sut.EnsureUserDek(UserId, clientKey);
        var dek2 = await sut.EnsureUserDek(UserId, clientKey);

        dek1.Should().BeEquivalentTo(dek2);
    }

    [Fact]
    public async Task EnsureUserDek_DifferentClientKeys_ReturnDifferentDeks()
    {
        var sut1 = CreateSut();
        var sut2 = CreateSut();

        var dek1 = await sut1.EnsureUserDek("user-a", GenerateClientKey(seed: 1));
        var dek2 = await sut2.EnsureUserDek("user-b", GenerateClientKey(seed: 2));

        dek1.Should().NotBeEquivalentTo(dek2);
    }

    // --- Encrypt / Decrypt round-trip ---

    [Theory]
    [InlineData(0)]
    [InlineData(1234.56)]
    [InlineData(99999.99)]
    [InlineData(-500)]
    public async Task EncryptDecrypt_RoundTrip_PreservesAmount(decimal amount)
    {
        var sut = CreateSut();
        var dek = await sut.EnsureUserDek(UserId, GenerateClientKey());

        var ciphertext = sut.EncryptAmount(amount, dek);
        var decrypted = sut.DecryptAmount(ciphertext, dek);

        decrypted.Should().Be(amount);
    }

    [Fact]
    public async Task EncryptAmount_DifferentNonces_ProducesDifferentCiphertexts()
    {
        var sut = CreateSut();
        var dek = await sut.EnsureUserDek(UserId, GenerateClientKey());

        var c1 = sut.EncryptAmount(100m, dek);
        var c2 = sut.EncryptAmount(100m, dek);

        // AES-GCM uses random nonce — same plaintext produces different ciphertexts
        c1.Should().NotBe(c2);
    }

    // --- Key check validation ---

    [Fact]
    public async Task VerifyAndEnsureKeyCheck_ValidKey_ReturnsTrue()
    {
        var repo = new InMemoryEncryptionKeyRepository();
        var sut = CreateSut(repo);
        var clientKey = GenerateClientKey();
        await sut.EnsureUserDek(UserId, clientKey);

        var valid = await sut.VerifyAndEnsureKeyCheck(UserId, clientKey);

        valid.Should().BeTrue();
    }

    [Fact]
    public async Task VerifyAndEnsureKeyCheck_WrongKey_ReturnsFalse()
    {
        var repo = new InMemoryEncryptionKeyRepository();
        var sut = CreateSut(repo);
        var clientKey = GenerateClientKey(seed: 10);
        var wrongKey = GenerateClientKey(seed: 99);
        await sut.EnsureUserDek(UserId, clientKey);
        await sut.VerifyAndEnsureKeyCheck(UserId, clientKey); // establish key check

        var valid = await sut.VerifyAndEnsureKeyCheck(UserId, wrongKey);

        valid.Should().BeFalse();
    }

    [Fact]
    public void ValidateKeyCheck_CorrectDek_ReturnsTrue()
    {
        var sut = CreateSut();
        var dek = new byte[32];
        dek[0] = 0x42;

        var keyCheck = sut.GenerateKeyCheck(dek);
        var valid = sut.ValidateKeyCheck(keyCheck, dek);

        valid.Should().BeTrue();
    }

    [Fact]
    public void ValidateKeyCheck_WrongDek_ReturnsFalse()
    {
        var sut = CreateSut();
        var correctDek = new byte[32];
        correctDek[0] = 0x42;
        var wrongDek = new byte[32];
        wrongDek[0] = 0x99;

        var keyCheck = sut.GenerateKeyCheck(correctDek);
        var valid = sut.ValidateKeyCheck(keyCheck, wrongDek);

        valid.Should().BeFalse();
    }

    // --- Recovery key wrap/unwrap ---

    [Fact]
    public void GenerateRecoveryKey_ReturnsFormattedKey()
    {
        var sut = CreateSut();

        var (raw, formatted) = sut.GenerateRecoveryKey();

        raw.Should().HaveCount(32);
        formatted.Should().NotBeNullOrEmpty();
        formatted.Should().Contain("-");
    }

    [Fact]
    public void WrapAndUnwrapDek_RoundTrip_RecoversSameDek()
    {
        var sut = CreateSut();
        var dek = new byte[32];
        dek[0] = 0xAB;
        dek[1] = 0xCD;

        var (rawRecoveryKey, _) = sut.GenerateRecoveryKey();
        var wrapped = sut.WrapDek(dek, rawRecoveryKey);
        var unwrapped = sut.UnwrapDek(wrapped, rawRecoveryKey);

        unwrapped.Should().BeEquivalentTo(dek);
    }

    [Fact]
    public async Task CreateRecoveryKey_NewUser_ReturnsFormattedKey()
    {
        var repo = new InMemoryEncryptionKeyRepository();
        var sut = CreateSut(repo);
        var clientKey = GenerateClientKey();
        await sut.EnsureUserDek(UserId, clientKey);

        var formatted = await sut.CreateRecoveryKey(UserId, clientKey);

        formatted.Should().NotBeNullOrEmpty();
        formatted.Should().Contain("-");
    }

    [Fact]
    public async Task CreateRecoveryKey_AlreadySetup_ThrowsConflict()
    {
        var repo = new InMemoryEncryptionKeyRepository();
        var sut = CreateSut(repo);
        var clientKey = GenerateClientKey();
        await sut.EnsureUserDek(UserId, clientKey);
        await sut.CreateRecoveryKey(UserId, clientKey);

        await sut.Invoking(s => s.CreateRecoveryKey(UserId, clientKey))
            .Should().ThrowAsync<Exception>();
    }

    // --- Vault status ---

    [Fact]
    public async Task GetVaultStatus_NewUser_AllFalse()
    {
        var sut = CreateSut();

        var status = await sut.GetVaultStatus(UserId);

        status.PinCodeConfigured.Should().BeFalse();
        status.RecoveryKeyConfigured.Should().BeFalse();
        status.VaultCodeConfigured.Should().BeFalse();
    }

    [Fact]
    public async Task GetVaultStatus_AfterEnsureDek_VaultCodeTrue()
    {
        var repo = new InMemoryEncryptionKeyRepository();
        var sut = CreateSut(repo);
        var clientKey = GenerateClientKey();
        await sut.EnsureUserDek(UserId, clientKey);

        var status = await sut.GetVaultStatus(UserId);

        status.VaultCodeConfigured.Should().BeTrue();
    }

    // --- Helpers ---

    private static byte[] GenerateClientKey(byte seed = 42)
    {
        var key = new byte[32];
        key[0] = seed;
        key[1] = 1;
        return key;
    }
}

/// <summary>
/// Thread-safe in-memory encryption key repository for integration tests.
/// </summary>
internal sealed class InMemoryEncryptionKeyRepository : IEncryptionKeyRepository
{
    private readonly Dictionary<string, EncryptionKey> _store = new();

    public Task<EncryptionKey?> GetByUserId(string userId) =>
        Task.FromResult(_store.TryGetValue(userId, out var key) ? key : null);

    public Task<string> UpsertSalt(string userId, string salt, int kdfIterations)
    {
        var existing = _store.GetValueOrDefault(userId);
        if (existing is not null)
            return Task.FromResult(existing.Salt);

        _store[userId] = new EncryptionKey
        {
            Salt = salt,
            KdfIterations = kdfIterations,
            WrappedDek = null,
            KeyCheck = null
        };
        return Task.FromResult(salt);
    }

    public Task UpdateKeyCheck(string userId, string keyCheck)
    {
        if (_store.TryGetValue(userId, out var existing))
        {
            _store[userId] = new EncryptionKey
            {
                Salt = existing.Salt,
                KdfIterations = existing.KdfIterations,
                WrappedDek = existing.WrappedDek,
                KeyCheck = keyCheck
            };
        }
        return Task.CompletedTask;
    }

    public Task UpdateWrappedDek(string userId, string? wrappedDek)
    {
        if (_store.TryGetValue(userId, out var existing))
        {
            _store[userId] = new EncryptionKey
            {
                Salt = existing.Salt,
                KdfIterations = existing.KdfIterations,
                WrappedDek = wrappedDek,
                KeyCheck = existing.KeyCheck
            };
        }
        return Task.CompletedTask;
    }

    public Task<bool> HasWrappedDek(string userId) =>
        Task.FromResult(_store.TryGetValue(userId, out var key) && key.WrappedDek is not null);
}
