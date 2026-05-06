using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Transaction.Dto;

public record TransactionUpdateDto(
    string? Name,
    decimal? Amount,
    TransactionKind? Kind,
    DateTimeOffset? TransactionDate = null,
    string? Category = null
);

public sealed class TransactionUpdateDtoValidator : AbstractValidator<TransactionUpdateDto>
{
    public TransactionUpdateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name cannot be empty")
            .MaximumLength(Constants.NameMaxLength)
            .WithMessage($"Name cannot exceed {Constants.NameMaxLength} characters")
            .When(x => x.Name is not null);

        RuleFor(x => x.Amount)
            .GreaterThan(0)
            .WithMessage("Amount must be greater than 0")
            .LessThanOrEqualTo(Constants.MaxAmount)
            .WithMessage($"Amount cannot exceed {Constants.MaxAmount}")
            .When(x => x.Amount.HasValue);

        RuleFor(x => x.Kind)
            .IsInEnum()
            .WithMessage("Kind must be a valid transaction kind")
            .When(x => x.Kind.HasValue);
    }
}
