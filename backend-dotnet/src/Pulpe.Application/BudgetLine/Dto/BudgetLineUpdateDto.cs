using FluentValidation;
using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Application.BudgetLine.Dto;

public record BudgetLineUpdateDto(
    string? Name,
    decimal? Amount,
    TransactionKind? Kind,
    TransactionRecurrence? Recurrence,
    decimal? OriginalAmount = null,
    SupportedCurrency? OriginalCurrency = null,
    SupportedCurrency? TargetCurrency = null,
    decimal? ExchangeRate = null
) : IFxCarrier;

public sealed class BudgetLineUpdateDtoValidator : AbstractValidator<BudgetLineUpdateDto>
{
    public BudgetLineUpdateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name cannot be empty")
            .MaximumLength(Constants.NameMaxLength)
            .WithMessage($"Name cannot exceed {Constants.NameMaxLength} characters")
            .When(x => x.Name is not null);

        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(0)
            .WithMessage("Amount must be greater than or equal to 0")
            .LessThanOrEqualTo(Constants.MaxAmount)
            .WithMessage($"Amount cannot exceed {Constants.MaxAmount}")
            .When(x => x.Amount.HasValue);

        RuleFor(x => x.Kind)
            .IsInEnum()
            .WithMessage("Kind must be a valid transaction kind")
            .When(x => x.Kind.HasValue);

        RuleFor(x => x.Recurrence)
            .IsInEnum()
            .WithMessage("Recurrence must be a valid transaction recurrence")
            .When(x => x.Recurrence.HasValue);
    }
}
