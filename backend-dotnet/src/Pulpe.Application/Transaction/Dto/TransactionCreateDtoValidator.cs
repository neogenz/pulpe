using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Transaction.Dto;

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
