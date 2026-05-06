using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Budget.Dto;

public record BudgetUpdateDto(string? Description, int? Month, int? Year);

public sealed class BudgetUpdateDtoValidator : AbstractValidator<BudgetUpdateDto>
{
    public BudgetUpdateDtoValidator()
    {
        RuleFor(x => x.Month)
            .InclusiveBetween(Constants.MonthMin, Constants.MonthMax)
            .WithMessage($"Month must be between {Constants.MonthMin} and {Constants.MonthMax}")
            .When(x => x.Month.HasValue);

        RuleFor(x => x.Year)
            .InclusiveBetween(Constants.MinYear, Constants.MaxYear)
            .WithMessage($"Year must be between {Constants.MinYear} and {Constants.MaxYear}")
            .When(x => x.Year.HasValue);

        RuleFor(x => x.Description)
            .MaximumLength(Constants.DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {Constants.DescriptionMaxLength} characters")
            .When(x => x.Description is not null);
    }
}
