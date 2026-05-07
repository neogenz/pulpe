using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Application.Currency;

/// <summary>
/// Resolved FX metadata after running the 3-state machine.
/// Fields with Changed=true must be written to the persistence payload.
/// </summary>
public sealed record FxOverrideResult(
    decimal? OriginalAmount,
    SupportedCurrency? OriginalCurrency,
    SupportedCurrency? TargetCurrency,
    decimal? ExchangeRate,
    bool OriginalAmountChanged,
    bool OriginalCurrencyChanged,
    bool TargetCurrencyChanged,
    bool ExchangeRateChanged
);

public sealed class CurrencyService : ICurrencyService
{
    private const int TtlHours = 24;
    private const decimal IdentityRate = 1m;

    private sealed record CachedRate(decimal Rate, DateOnly Date, DateTimeOffset ExpiresAt);

    private readonly ConcurrentDictionary<string, CachedRate> _cache = new();
    private readonly ConcurrentDictionary<string, Task<CurrencyRateResult>> _inFlight = new();
    private readonly IFrankfurterClient _frankfurterClient;
    private readonly ILogger<CurrencyService> _logger;

    public CurrencyService(IFrankfurterClient frankfurterClient, ILogger<CurrencyService> logger)
    {
        _frankfurterClient = frankfurterClient;
        _logger = logger;
    }

    public async Task<CurrencyRateResult> GetRate(
        SupportedCurrency baseCurrency,
        SupportedCurrency targetCurrency,
        CancellationToken ct = default)
    {
        if (baseCurrency == targetCurrency)
            return new CurrencyRateResult(baseCurrency, targetCurrency, IdentityRate, DateOnly.FromDateTime(DateTime.UtcNow));

        var cacheKey = $"{baseCurrency}_{targetCurrency}";

        if (_cache.TryGetValue(cacheKey, out var cached) && cached.ExpiresAt > DateTimeOffset.UtcNow)
            return new CurrencyRateResult(baseCurrency, targetCurrency, cached.Rate, cached.Date);

        _cache.TryGetValue(cacheKey, out var stale);

        var fetchTask = _inFlight.GetOrAdd(cacheKey, _ =>
            FetchAndCache(baseCurrency, targetCurrency, cacheKey, ct)
                .ContinueWith(t =>
                {
                    _inFlight.TryRemove(cacheKey, out Task<CurrencyRateResult>? _);
                    if (t.IsFaulted) throw t.Exception!.GetBaseException();
                    return t.Result;
                }, TaskContinuationOptions.ExecuteSynchronously));

        try
        {
            return await fetchTask;
        }
        catch (Exception ex)
        {
            return HandleFetchFailure(baseCurrency, targetCurrency, stale, ex);
        }
    }

    public Task<FxOverrideResult> ComputeOverride(IFxCarrier carrier, CancellationToken ct = default)
    {
        ValidateFxMetadata(carrier);

        var sameCurrency = carrier.OriginalCurrency.HasValue
            && carrier.TargetCurrency.HasValue
            && carrier.OriginalCurrency == carrier.TargetCurrency;

        var missingPair = !carrier.OriginalCurrency.HasValue || !carrier.TargetCurrency.HasValue;

        if (sameCurrency)
            return Task.FromResult(BuildSameCurrencyResult(carrier));

        if (missingPair)
            return Task.FromResult(BuildMissingPairResult(carrier));

        return BuildFullFxResultAsync(carrier, ct);
    }

    private static void ValidateFxMetadata(IFxCarrier carrier)
    {
        if (carrier.ExchangeRate.HasValue && carrier.ExchangeRate.Value <= 0)
            throw new BusinessException(
                ErrorCodes.CurrencyInvalidFxMetadata,
                "ExchangeRate must be a positive number");
    }

    // Branch A: same-currency — null the 3 source fields, preserve targetCurrency
    private static FxOverrideResult BuildSameCurrencyResult(IFxCarrier carrier)
    {
        var currency = carrier.OriginalCurrency!.Value;
        if (!Enum.IsDefined(currency))
            throw new BusinessException(
                ErrorCodes.CurrencyUnsupportedCurrency,
                $"Unsupported currency: {currency}");

        return new FxOverrideResult(
            OriginalAmount: null,
            OriginalCurrency: null,
            TargetCurrency: carrier.TargetCurrency,
            ExchangeRate: null,
            OriginalAmountChanged: true,
            OriginalCurrencyChanged: true,
            TargetCurrencyChanged: true,
            ExchangeRateChanged: true
        );
    }

    // Branch B: incomplete pair — null source fields if any FX key was touched
    private static FxOverrideResult BuildMissingPairResult(IFxCarrier carrier)
    {
        var touchesAnyFx = carrier.OriginalAmount.HasValue
            || carrier.OriginalCurrency.HasValue
            || carrier.ExchangeRate.HasValue
            || carrier.TargetCurrency.HasValue;

        return new FxOverrideResult(
            OriginalAmount: null,
            OriginalCurrency: null,
            TargetCurrency: carrier.TargetCurrency,
            ExchangeRate: null,
            OriginalAmountChanged: touchesAnyFx,
            OriginalCurrencyChanged: touchesAnyFx,
            TargetCurrencyChanged: carrier.TargetCurrency.HasValue,
            ExchangeRateChanged: touchesAnyFx
        );
    }

    // Branch C: full pair, different currencies — fetch rate
    private async Task<FxOverrideResult> BuildFullFxResultAsync(IFxCarrier carrier, CancellationToken ct)
    {
        var baseCurrency = carrier.OriginalCurrency!.Value;
        var targetCurrency = carrier.TargetCurrency!.Value;

        if (!Enum.IsDefined(baseCurrency))
            throw new BusinessException(ErrorCodes.CurrencyUnsupportedCurrency, $"Unsupported currency: {baseCurrency}");
        if (!Enum.IsDefined(targetCurrency))
            throw new BusinessException(ErrorCodes.CurrencyUnsupportedCurrency, $"Unsupported currency: {targetCurrency}");

        if (!carrier.OriginalAmount.HasValue)
            throw new BusinessException(
                ErrorCodes.ValidationFailed,
                "originalAmount required when originalCurrency != targetCurrency",
                statusCode: 400);

        var rate = await GetRate(baseCurrency, targetCurrency, ct);

        return new FxOverrideResult(
            OriginalAmount: carrier.OriginalAmount,
            OriginalCurrency: baseCurrency,
            TargetCurrency: targetCurrency,
            ExchangeRate: rate.Rate,
            OriginalAmountChanged: true,
            OriginalCurrencyChanged: true,
            TargetCurrencyChanged: true,
            ExchangeRateChanged: true
        );
    }

    private async Task<CurrencyRateResult> FetchAndCache(
        SupportedCurrency baseCurrency,
        SupportedCurrency targetCurrency,
        string cacheKey,
        CancellationToken ct)
    {
        var response = await _frankfurterClient.GetLatest(baseCurrency, targetCurrency, ct);

        if (!response.Rates.TryGetValue(targetCurrency.ToIsoCode(), out var rate) || rate <= 0)
            throw new BusinessException(
                ErrorCodes.CurrencyRateFetchFailed,
                $"Invalid rate received for {baseCurrency}/{targetCurrency}");

        var date = response.Date;
        _cache[cacheKey] = new CachedRate(rate, date, DateTimeOffset.UtcNow.AddHours(TtlHours));

        _logger.LogInformation(
            "Currency rate fetched and cached: {Base}/{Target} = {Rate} ({Date})",
            baseCurrency, targetCurrency, rate, date);

        return new CurrencyRateResult(baseCurrency, targetCurrency, rate, date);
    }

    private CurrencyRateResult HandleFetchFailure(
        SupportedCurrency baseCurrency,
        SupportedCurrency targetCurrency,
        CachedRate? stale,
        Exception ex)
    {
        if (stale is not null)
        {
            _logger.LogWarning(
                "Frankfurter unavailable, returning stale rate for {Base}/{Target} from {Date}",
                baseCurrency, targetCurrency, stale.Date);
            return new CurrencyRateResult(baseCurrency, targetCurrency, stale.Rate, stale.Date);
        }

        _logger.LogWarning(ex,
            "Currency API unavailable and no cached rate for {Base}/{Target}, rejecting request",
            baseCurrency, targetCurrency);

        throw new BusinessException(
            ErrorCodes.CurrencyRateFetchFailed,
            $"Failed to fetch exchange rate for {baseCurrency}/{targetCurrency}");
    }
}
