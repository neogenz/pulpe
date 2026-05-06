using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.BudgetLine.Dto;

public sealed class BudgetLineCreateDtoValidator : AbstractValidator<BudgetLineCreateDto>
{
    public BudgetLineCreateDtoValidator()
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
            .GreaterThanOrEqualTo(0)
            .WithMessage("Amount must be greater than or equal to 0")
            .LessThanOrEqualTo(Constants.MaxAmount)
            .WithMessage($"Amount cannot exceed {Constants.MaxAmount}");

        RuleFor(x => x.Kind)
            .IsInEnum()
            .WithMessage("Kind must be a valid transaction kind");

        RuleFor(x => x.Recurrence)
            .IsInEnum()
            .WithMessage("Recurrence must be a valid transaction recurrence");
    }
}
