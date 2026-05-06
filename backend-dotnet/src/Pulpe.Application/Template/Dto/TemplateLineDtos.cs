using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Template.Dto;

public record TemplateLineCreateDto(
    string Name,
    decimal Amount,
    TransactionKind Kind,
    TransactionRecurrence Recurrence,
    string? Description = null
);

public record TemplateLineUpdateDto(
    string? Name,
    decimal? Amount,
    TransactionKind? Kind,
    TransactionRecurrence? Recurrence,
    string? Description = null
);

public record TemplateLineUpdateWithIdDto(
    Guid Id,
    string? Name,
    decimal? Amount,
    TransactionKind? Kind,
    TransactionRecurrence? Recurrence,
    string? Description = null
);

public record TemplateLinesBulkUpdateDto(List<TemplateLineUpdateWithIdDto> Lines);

public record TemplateLinesBulkOperationsDto(
    List<TemplateLineCreateDto>? Create,
    List<TemplateLineUpdateWithIdDto>? Update,
    List<Guid>? Delete,
    bool PropagateToBudgets = false
);

public sealed class TemplateLineCreateDtoValidator : AbstractValidator<TemplateLineCreateDto>
{
    public TemplateLineCreateDtoValidator()
    {
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

        RuleFor(x => x.Recurrence)
            .IsInEnum()
            .WithMessage("Recurrence must be a valid transaction recurrence");

        RuleFor(x => x.Description)
            .MaximumLength(Constants.DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {Constants.DescriptionMaxLength} characters")
            .When(x => x.Description is not null);
    }
}

public sealed class TemplateLineUpdateDtoValidator : AbstractValidator<TemplateLineUpdateDto>
{
    public TemplateLineUpdateDtoValidator()
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

        RuleFor(x => x.Recurrence)
            .IsInEnum()
            .WithMessage("Recurrence must be a valid transaction recurrence")
            .When(x => x.Recurrence.HasValue);

        RuleFor(x => x.Description)
            .MaximumLength(Constants.DescriptionMaxLength)
            .WithMessage($"Description cannot exceed {Constants.DescriptionMaxLength} characters")
            .When(x => x.Description is not null);
    }
}

public sealed class TemplateLinesBulkUpdateDtoValidator : AbstractValidator<TemplateLinesBulkUpdateDto>
{
    public TemplateLinesBulkUpdateDtoValidator()
    {
        RuleFor(x => x.Lines)
            .NotNull()
            .WithMessage("Lines is required")
            .NotEmpty()
            .WithMessage("Lines cannot be empty");
    }
}

public sealed class TemplateLinesBulkOperationsDtoValidator : AbstractValidator<TemplateLinesBulkOperationsDto>
{
    public TemplateLinesBulkOperationsDtoValidator()
    {
        RuleFor(x => x)
            .Must(dto =>
            {
                var total = (dto.Create?.Count ?? 0) + (dto.Update?.Count ?? 0) + (dto.Delete?.Count ?? 0);
                return total <= Constants.MaxBulkOperations;
            })
            .WithMessage($"Total operations cannot exceed {Constants.MaxBulkOperations}");
    }
}
