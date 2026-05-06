using Pulpe.Domain.Currency;

namespace Pulpe.Application.Currency;

public record FrankfurterResponse(string Base, DateOnly Date, IReadOnlyDictionary<string, decimal> Rates);

public interface IFrankfurterClient
{
    Task<FrankfurterResponse> GetLatest(SupportedCurrency baseCurrency, SupportedCurrency targetCurrency, CancellationToken ct = default);
}
