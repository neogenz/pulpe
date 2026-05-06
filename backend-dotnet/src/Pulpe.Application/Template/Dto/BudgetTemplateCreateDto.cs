using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Template.Dto;

public record BudgetTemplateCreateDto(
    string Name,
    string? Description,
    bool IsDefault = false,
    List<TemplateLineCreateDto>? Lines = null
);

public sealed class BudgetTemplateCreateDtoValidator : AbstractValidator<BudgetTemplateCreateDto>
{
    public BudgetTemplateCreateDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name is required")
            .MaximumLength(Constants.NameMaxLength)
            .WithMessage($"Name cannot exceed {Constants.NameMaxLength} characters");

        RuleFor(x => x.Description)
            .MaximumLength(Constants.DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {Constants.DescriptionMaxLength} characters")
            .When(x => x.Description is not null);

        RuleForEach(x => x.Lines)
            .SetValidator(new TemplateLineCreateDtoValidator())
            .When(x => x.Lines is not null && x.Lines.Count > 0);
    }
}
