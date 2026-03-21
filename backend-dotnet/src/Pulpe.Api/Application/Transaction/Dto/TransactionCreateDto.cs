using FluentValidation;
using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Application.Transaction.Dto;

public record TransactionCreateDto(
    Guid BudgetId,
    string Name,
    decimal Amount,
    TransactionKind Kind,
    Guid? BudgetLineId = null,
    DateTimeOffset? TransactionDate = null,
    string? Category = null
);

public sealed class TransactionCreateDtoValidator : AbstractValidator<TransactionCreateDto>
{
    public TransactionCreateDtoValidator()
    {
        RuleFor(x => x.BudgetId)
            .NotEmpty()
            .WithMessage("BudgetId is required");

        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name is required")
            .MaximumLength(Constants.NameMaxLength)
            .WithMessage($"Name cannot exceed {Constants.NameMaxLength} characters");

        RuleFor(x => x.Amount)
            .GreaterThan(0)
            .WithMessage("Amount must be greater than 0")
            .LessThanOrEqualTo(Constants.MaxAmount)
            .WithMessage($"Amount cannot exceed {Constants.MaxAmount}");

        RuleFor(x => x.Kind)
            .IsInEnum()
            .WithMessage("Kind must be a valid transaction kind");
    }
}
