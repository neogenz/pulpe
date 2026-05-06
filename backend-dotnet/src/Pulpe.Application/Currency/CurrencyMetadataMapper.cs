using Pulpe.Domain.Currency;

namespace Pulpe.Application.Currency;

/// <summary>
/// Maps FX override results to a sparse DB column dict.
/// Only emits keys for fields that changed — prevents PATCH from clobbering
/// FX columns the client didn't touch.
/// </summary>
public static class CurrencyMetadataMapper
{
    public static void ApplyToDict(Dictionary<string, object?> dict, FxOverrideResult fx)
    {
        if (fx.OriginalAmountChanged)
            dict["original_amount"] = fx.OriginalAmount;
        if (fx.OriginalCurrencyChanged)
            dict["original_currency"] = fx.OriginalCurrency?.ToIsoCode();
        if (fx.TargetCurrencyChanged)
            dict["target_currency"] = fx.TargetCurrency?.ToIsoCode();
        if (fx.ExchangeRateChanged)
            dict["exchange_rate"] = fx.ExchangeRate;
    }
}
