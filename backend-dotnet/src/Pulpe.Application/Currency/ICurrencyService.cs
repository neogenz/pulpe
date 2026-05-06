using Pulpe.Domain.Currency;

namespace Pulpe.Application.Currency;

public record CurrencyRateResult(SupportedCurrency Base, SupportedCurrency Target, decimal Rate, DateOnly Date);

public interface ICurrencyService
{
    Task<CurrencyRateResult> GetRate(SupportedCurrency baseCurrency, SupportedCurrency targetCurrency, CancellationToken ct = default);

    /// <summary>
    /// Runs the 3-branch FX state machine. Returns resolved metadata;
    /// callers apply Changed=true fields to their persistence payload.
    /// </summary>
    Task<FxOverrideResult> ComputeOverride(IFxCarrier carrier, CancellationToken ct = default);
}
