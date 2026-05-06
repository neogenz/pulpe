using FluentValidation;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Template.Dto;

public record OnboardingTransactionDto(
    decimal Amount,
    TransactionKind Type,
    string Name,
    string? Description,
    TransactionRecurrence ExpenseType,
    bool IsRecurring
);

public record BudgetTemplateCreateFromOnboardingDto(
    string Name = "Mois Standard",
    string? Description = null,
    bool IsDefault = true,
    decimal MonthlyIncome = 0,
    decimal HousingCosts = 0,
    decimal HealthInsurance = 0,
    decimal LeasingCredit = 0,
    decimal PhonePlan = 0,
    decimal InternetPlan = 0,
    decimal TransportCosts = 0,
    List<OnboardingTransactionDto>? CustomTransactions = null
);

public sealed class BudgetTemplateCreateFromOnboardingDtoValidator : AbstractValidator<BudgetTemplateCreateFromOnboardingDto>
{
    public BudgetTemplateCreateFromOnboardingDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .WithMessage("Name is required")
            .MaximumLength(Constants.NameMaxLength)
            .WithMessage($"Name cannot exceed {Constants.NameMaxLength} characters");

        RuleFor(x => x.MonthlyIncome)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);

        RuleFor(x => x.HousingCosts)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);

        RuleFor(x => x.HealthInsurance)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);

        RuleFor(x => x.LeasingCredit)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);

        RuleFor(x => x.PhonePlan)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);

        RuleFor(x => x.InternetPlan)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);

        RuleFor(x => x.TransportCosts)
            .GreaterThanOrEqualTo(0)
            .LessThanOrEqualTo(Constants.MaxAmount);
    }
}
