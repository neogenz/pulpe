using FluentValidation;

namespace Pulpe.Application.Encryption.Dto;

public record EncryptionValidateKeyRequestDto(string ClientKey);

public record EncryptionRecoverRequestDto(string RecoveryKey, string NewClientKey);

public record EncryptionChangePinRequestDto(string OldClientKey, string NewClientKey);

public record EncryptionVaultStatusResponseDto(bool PinCodeConfigured, bool RecoveryKeyConfigured, bool VaultCodeConfigured);

public record EncryptionSaltResponseDto(string Salt, int KdfIterations, bool HasRecoveryKey);

public record EncryptionSetupRecoveryResponseDto(string RecoveryKey);

public record EncryptionRecoverResponseDto(bool Success);

public record EncryptionChangePinResponseDto(string KeyCheck, string RecoveryKey);

public sealed class EncryptionValidateKeyRequestValidator : AbstractValidator<EncryptionValidateKeyRequestDto>
{
    public EncryptionValidateKeyRequestValidator()
    {
        RuleFor(x => x.ClientKey)
            .NotEmpty()
            .Length(64)
            .Matches("^[0-9a-fA-F]{64}$").WithMessage("ClientKey must be 64 hexadecimal characters");
    }
}

public sealed class EncryptionRecoverRequestValidator : AbstractValidator<EncryptionRecoverRequestDto>
{
    public EncryptionRecoverRequestValidator()
    {
        RuleFor(x => x.NewClientKey)
            .NotEmpty()
            .Length(64)
            .Matches("^[0-9a-fA-F]{64}$").WithMessage("NewClientKey must be 64 hexadecimal characters");
        RuleFor(x => x.RecoveryKey)
            .NotEmpty();
    }
}

public sealed class EncryptionChangePinRequestValidator : AbstractValidator<EncryptionChangePinRequestDto>
{
    public EncryptionChangePinRequestValidator()
    {
        RuleFor(x => x.OldClientKey)
            .NotEmpty()
            .Length(64)
            .Matches("^[0-9a-fA-F]{64}$").WithMessage("OldClientKey must be 64 hexadecimal characters");
        RuleFor(x => x.NewClientKey)
            .NotEmpty()
            .Length(64)
            .Matches("^[0-9a-fA-F]{64}$").WithMessage("NewClientKey must be 64 hexadecimal characters");
    }
}
