using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Application.BudgetLine.Dto;

public record BudgetLineCreateDto(
    Guid BudgetId,
    string Name,
    decimal Amount,
    TransactionKind Kind,
    TransactionRecurrence Recurrence,
    bool IsManuallyAdjusted = false,
    Guid? TemplateLineId = null,
    Guid? SavingsGoalId = null,
    DateTimeOffset? CheckedAt = null,
    decimal? OriginalAmount = null,
    SupportedCurrency? OriginalCurrency = null,
    SupportedCurrency? TargetCurrency = null,
    decimal? ExchangeRate = null,
    Guid? Id = null
) : IFxCarrier;
