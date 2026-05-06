using Pulpe.Domain.Currency;

namespace Pulpe.Application.Currency.Dto;

public record CurrencyRateQueryDto(SupportedCurrency Base, SupportedCurrency Target);

public record CurrencyRateResponseDto(SupportedCurrency Base, SupportedCurrency Target, decimal Rate, DateOnly Date);
