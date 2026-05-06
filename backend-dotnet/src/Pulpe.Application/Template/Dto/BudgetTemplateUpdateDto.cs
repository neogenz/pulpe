using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Template.Dto;

public record BudgetTemplateUpdateDto(
    string? Name,
    string? Description,
    bool? IsDefault
);

public sealed class BudgetTemplateUpdateDtoValidator : AbstractValidator<BudgetTemplateUpdateDto>
{
    public BudgetTemplateUpdateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name cannot be empty")
            .MaximumLength(Constants.NameMaxLength)
            .WithMessage($"Name cannot exceed {Constants.NameMaxLength} characters")
            .When(x => x.Name is not null);

        RuleFor(x => x.Description)
            .MaximumLength(Constants.DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {Constants.DescriptionMaxLength} characters")
            .When(x => x.Description is not null);
    }
}
