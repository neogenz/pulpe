using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Budget.Dto;

public record BudgetCreateDto(int Month, int Year, string Description, Guid TemplateId);

public sealed class BudgetCreateDtoValidator : AbstractValidator<BudgetCreateDto>
{
    public BudgetCreateDtoValidator()
    {
        RuleFor(x => x.Month)
            .InclusiveBetween(Constants.MonthMin, Constants.MonthMax)
            .WithMessage($"Month must be between {Constants.MonthMin} and {Constants.MonthMax}");

        RuleFor(x => x.Year)
            .InclusiveBetween(Constants.MinYear, Constants.MaxYear)
            .WithMessage($"Year must be between {Constants.MinYear} and {Constants.MaxYear}");

        RuleFor(x => x.Description)
            .MaximumLength(Constants.DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {Constants.DescriptionMaxLength} characters")
            .When(x => x.Description is not null);

        RuleFor(x => x.TemplateId)
            .NotEmpty()
            .WithMessage("TemplateId is required");
    }
}
