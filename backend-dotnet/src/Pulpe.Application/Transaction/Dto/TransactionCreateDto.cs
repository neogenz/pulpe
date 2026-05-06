using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Application.Transaction.Dto;

public record TransactionCreateDto(
    Guid BudgetId,
    string Name,
    decimal Amount,
    TransactionKind Kind,
    Guid? BudgetLineId = null,
    DateTimeOffset? TransactionDate = null,
    string? Category = null,
    DateTimeOffset? CheckedAt = null,
    decimal? OriginalAmount = null,
    SupportedCurrency? OriginalCurrency = null,
    SupportedCurrency? TargetCurrency = null,
    decimal? ExchangeRate = null,
    Guid? Id = null
) : IFxCarrier;
