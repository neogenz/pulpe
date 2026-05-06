using System.Security.Cryptography;
using FluentAssertions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Pulpe.Application.Encryption;
using Pulpe.Application.Encryption.Dto;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;

namespace Pulpe.Api.Tests.Application.Encryption;

public class EncryptionAppServiceTests
{
    private readonly IEncryptionService _encryptionService = Substitute.For<IEncryptionService>();
    private readonly EncryptionAppService _sut;

    public EncryptionAppServiceTests()
    {
        _sut = new EncryptionAppService(_encryptionService);
    }

    // --- GetVaultStatusAsync ---

    [Fact]
    public async Task GetVaultStatusAsync_ReturnsDto()
    {
        var vaultStatus = new VaultStatus(true, false, true);
        _encryptionService.GetVaultStatus("user-1").Returns(vaultStatus);

        var result = await _sut.GetVaultStatusAsync("user-1");

        result.Should().BeOfType<EncryptionVaultStatusResponseDto>();
        var dto = (EncryptionVaultStatusResponseDto)result;
        dto.PinCodeConfigured.Should().BeTrue();
        dto.RecoveryKeyConfigured.Should().BeFalse();
        dto.VaultCodeConfigured.Should().BeTrue();
    }

    // --- GetSaltAsync ---

    [Fact]
    public async Task GetSaltAsync_ReturnsDto()
    {
        var saltInfo = new SaltInfo("abc123salt", 100_000, true);
        _encryptionService.GetUserSalt("user-1").Returns(saltInfo);

        var result = await _sut.GetSaltAsync("user-1");

        result.Should().BeOfType<EncryptionSaltResponseDto>();
        var dto = (EncryptionSaltResponseDto)result;
        dto.Salt.Should().Be("abc123salt");
        dto.KdfIterations.Should().Be(100_000);
        dto.HasRecoveryKey.Should().BeTrue();
    }

    // --- ValidateKeyAsync ---

    [Fact]
    public async Task ValidateKeyAsync_ValidKey_DoesNotThrow()
    {
        var hex = new string('a', 64);
        _encryptionService.VerifyAndEnsureKeyCheck("user-1", Arg.Any<byte[]>()).Returns(true);

        await _sut.Invoking(s => s.ValidateKeyAsync("user-1", hex))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task ValidateKeyAsync_InvalidKey_ThrowsBusinessException()
    {
        var hex = new string('b', 64);
        _encryptionService.VerifyAndEnsureKeyCheck("user-1", Arg.Any<byte[]>()).Returns(false);

        var act = () => _sut.ValidateKeyAsync("user-1", hex);

        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.StatusCode == 401);
    }

    [Theory]
    [InlineData("")]
    [InlineData("abc")]                      // too short
    [InlineData("aabbcc")]                   // 6 chars
    public async Task ValidateKeyAsync_MalformedHex_ThrowsBusinessException(string badHex)
    {
        var act = () => _sut.ValidateKeyAsync("user-1", badHex);

        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.StatusCode == 400);
    }

    // --- ParseHex boundary (via ValidateKeyAsync) ---

    [Fact]
    public async Task ValidateKeyAsync_Exactly63Chars_ThrowsBusinessException()
    {
        var hex = new string('a', 63);
        var act = () => _sut.ValidateKeyAsync("user-1", hex);
        await act.Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    [Fact]
    public async Task ValidateKeyAsync_Exactly65Chars_ThrowsBusinessException()
    {
        var hex = new string('a', 65);
        var act = () => _sut.ValidateKeyAsync("user-1", hex);
        await act.Should().ThrowAsync<BusinessException>().Where(ex => ex.StatusCode == 400);
    }

    // --- VerifyRecoveryKeyAsync ---

    [Fact]
    public async Task VerifyRecoveryKeyAsync_ValidKey_DoesNotThrow()
    {
        _encryptionService.VerifyRecoveryKey("user-1", "ABCD-EFGH").Returns(Task.CompletedTask);

        await _sut.Invoking(s => s.VerifyRecoveryKeyAsync("user-1", "ABCD-EFGH"))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task VerifyRecoveryKeyAsync_InvalidKey_PropagatesBusinessException()
    {
        var innerEx = new CryptographicException("bad tag");
        var bex = new BusinessException(ErrorCodes.EncryptionRecoveryFailed, "Invalid recovery key", 400, innerException: innerEx);
        _encryptionService.VerifyRecoveryKey("user-1", "WRONG-KEY").ThrowsAsync(bex);

        var act = async () => await _sut.VerifyRecoveryKeyAsync("user-1", "WRONG-KEY");

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.Code.Should().Be(ErrorCodes.EncryptionRecoveryFailed);
        ex.Which.InnerException.Should().Be(innerEx);
    }

    [Fact]
    public async Task VerifyRecoveryKeyAsync_NoWrappedDek_PropagatesBusinessException()
    {
        var bex = new BusinessException(ErrorCodes.EncryptionRecoveryFailed, "No recovery key configured", 400);
        _encryptionService.VerifyRecoveryKey("user-1", "ABCD").ThrowsAsync(bex);

        var act = async () => await _sut.VerifyRecoveryKeyAsync("user-1", "ABCD");

        var ex = await act.Should().ThrowAsync<BusinessException>();
        ex.Which.Code.Should().Be(ErrorCodes.EncryptionRecoveryFailed);
        ex.Which.StatusCode.Should().Be(400);
    }

    // --- SetupRecoveryAsync ---

    [Fact]
    public async Task SetupRecoveryAsync_ReturnsFormattedKey()
    {
        var clientKey = new byte[32];
        _encryptionService.CreateRecoveryKey("user-1", clientKey).Returns("XXXX-YYYY-ZZZZ");

        var result = await _sut.SetupRecoveryAsync("user-1", clientKey);

        result.Should().BeOfType<EncryptionSetupRecoveryResponseDto>();
        ((EncryptionSetupRecoveryResponseDto)result).RecoveryKey.Should().Be("XXXX-YYYY-ZZZZ");
    }

    // --- RegenerateRecoveryAsync ---

    [Fact]
    public async Task RegenerateRecoveryAsync_ReturnsNewFormattedKey()
    {
        var clientKey = new byte[32];
        _encryptionService.RegenerateRecoveryKey("user-1", clientKey).Returns("NEW-AAAA-BBBB");

        var result = await _sut.RegenerateRecoveryAsync("user-1", clientKey);

        result.Should().BeOfType<EncryptionSetupRecoveryResponseDto>();
        ((EncryptionSetupRecoveryResponseDto)result).RecoveryKey.Should().Be("NEW-AAAA-BBBB");
    }
}
