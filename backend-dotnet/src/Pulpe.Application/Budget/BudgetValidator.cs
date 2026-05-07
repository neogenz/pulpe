using Pulpe.Application.Budget.Dto;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;

namespace Pulpe.Application.Budget;

public sealed class BudgetValidator
{
    public void ValidateBudgetInput(BudgetCreateDto dto)
    {
        ValidateRequiredFields(dto);
        ValidateDateConstraints(dto);
        ValidateBusinessRules(dto);
    }

    public void ValidateUpdateBudgetDto(BudgetUpdateDto dto)
    {
        if (dto.Month.HasValue && (dto.Month.Value < Constants.MonthMin || dto.Month.Value > Constants.MonthMax))
        {
            throw BusinessException.BadRequest(
                ErrorCodes.BudgetInvalidMonth,
                $"Month must be between {Constants.MonthMin} and {Constants.MonthMax}");
        }

        if (dto.Year.HasValue && (dto.Year.Value < Constants.MinYear || dto.Year.Value > Constants.MaxYear))
        {
            throw BusinessException.BadRequest(
                ErrorCodes.ValidationFailed,
                $"Year must be between {Constants.MinYear} and {Constants.MaxYear}");
        }
    }

    public async Task ValidateNoDuplicatePeriod(IBudgetRepository repository, string userId, int month, int year, Guid? excludeId = null)
    {
        var exists = await repository.ExistsForPeriod(month, year, userId, excludeId);
        if (exists)
        {
            throw BusinessException.Conflict(
                ErrorCodes.BudgetAlreadyExists,
                $"A budget already exists for {month}/{year}");
        }
    }

    private static void ValidateRequiredFields(BudgetCreateDto dto)
    {
        var missingFields = new List<string>();
        if (dto.Month == 0) missingFields.Add("month");
        if (dto.Year == 0) missingFields.Add("year");
        if (dto.TemplateId == Guid.Empty) missingFields.Add("templateId");

        if (missingFields.Count > 0)
        {
            throw BusinessException.BadRequest(
                ErrorCodes.RequiredDataMissing,
                $"Required fields missing: {string.Join(", ", missingFields)}");
        }
    }

    private static void ValidateDateConstraints(BudgetCreateDto dto)
    {
        if (dto.Month < Constants.MonthMin || dto.Month > Constants.MonthMax)
        {
            throw BusinessException.BadRequest(
                ErrorCodes.BudgetInvalidMonth,
                $"Month must be between {Constants.MonthMin} and {Constants.MonthMax}");
        }

        if (dto.Year < Constants.MinYear || dto.Year > Constants.MaxYear)
        {
            throw BusinessException.BadRequest(
                ErrorCodes.ValidationFailed,
                $"Year must be between {Constants.MinYear} and {Constants.MaxYear}");
        }
    }

    private static void ValidateBusinessRules(BudgetCreateDto dto)
    {
        if (dto.Description is not null && dto.Description.Length > Constants.DescriptionMaxLength)
        {
            throw BusinessException.BadRequest(
                ErrorCodes.ValidationFailed,
                $"Description cannot exceed {Constants.DescriptionMaxLength} characters");
        }

        var budgetDate = new DateTime(dto.Year, dto.Month, 1);
        var maxFutureDate = new DateTime(DateTime.UtcNow.Year + 2, DateTime.UtcNow.Month, 1);

        if (budgetDate > maxFutureDate)
        {
            throw BusinessException.BadRequest(
                ErrorCodes.ValidationFailed,
                "Budget date cannot be more than 2 years in the future");
        }
    }
}
