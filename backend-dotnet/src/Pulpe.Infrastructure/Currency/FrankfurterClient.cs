using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Pulpe.Application.Currency;
using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Infrastructure.Currency;

public sealed class FrankfurterClient : IFrankfurterClient
{
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(5);

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<FrankfurterClient> _logger;

    public FrankfurterClient(IHttpClientFactory httpClientFactory, ILogger<FrankfurterClient> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<FrankfurterResponse> GetLatest(
        SupportedCurrency baseCurrency,
        SupportedCurrency targetCurrency,
        CancellationToken ct = default)
    {
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(RequestTimeout);

        var client = _httpClientFactory.CreateClient("Frankfurter");
        var url = $"https://api.frankfurter.dev/v1/latest?base={baseCurrency.ToIsoCode()}&symbols={targetCurrency.ToIsoCode()}";

        FrankfurterApiResponse? data;
        try
        {
            data = await client.GetFromJsonAsync<FrankfurterApiResponse>(url, cts.Token);
        }
        catch (Exception ex) when (ex is not BusinessException)
        {
            _logger.LogWarning(ex, "Frankfurter API request failed for {Base}/{Target}", baseCurrency, targetCurrency);
            throw new BusinessException(
                ErrorCodes.CurrencyRateFetchFailed,
                $"Failed to fetch exchange rate for {baseCurrency}/{targetCurrency}",
                innerException: ex);
        }

        if (data is null || data.Rates is null)
            throw new BusinessException(
                ErrorCodes.CurrencyRateFetchFailed,
                $"Null response from Frankfurter for {baseCurrency}/{targetCurrency}");

        var date = DateOnly.TryParse(data.Date, out var d) ? d : DateOnly.FromDateTime(DateTime.UtcNow);
        return new FrankfurterResponse(data.Base ?? baseCurrency.ToIsoCode(), date, data.Rates);
    }

    private sealed class FrankfurterApiResponse
    {
        [JsonPropertyName("base")]
        public string? Base { get; init; }

        [JsonPropertyName("date")]
        public string? Date { get; init; }

        [JsonPropertyName("rates")]
        public IReadOnlyDictionary<string, decimal>? Rates { get; init; }
    }
}
