using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Pulpe.Application.Currency;
using Pulpe.Domain.Common;
using Pulpe.Domain.Currency;

namespace Pulpe.Api.Tests.Application.Currency;

public class CurrencyServiceTests
{
    private readonly IFrankfurterClient _frankfurter = Substitute.For<IFrankfurterClient>();
    private CurrencyService CreateService() => new(_frankfurter, NullLogger<CurrencyService>.Instance);

    // ===== GetRate =====

    [Fact]
    public async Task GetRate_SameCurrency_ReturnsIdentityRate()
    {
        var svc = CreateService();
        var result = await svc.GetRate(SupportedCurrency.CHF, SupportedCurrency.CHF);
        result.Rate.Should().Be(1m);
        result.Base.Should().Be(SupportedCurrency.CHF);
        result.Target.Should().Be(SupportedCurrency.CHF);
    }

    [Fact]
    public async Task GetRate_FetchesFromFrankfurter()
    {
        _frankfurter.GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>())
            .Returns(new FrankfurterResponse("EUR", DateOnly.FromDateTime(DateTime.UtcNow),
                new Dictionary<string, decimal> { ["CHF"] = 0.95m }));

        var svc = CreateService();
        var result = await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);
        result.Rate.Should().Be(0.95m);
    }

    [Fact]
    public async Task GetRate_CachesOnSecondCall()
    {
        _frankfurter.GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>())
            .Returns(new FrankfurterResponse("EUR", DateOnly.FromDateTime(DateTime.UtcNow),
                new Dictionary<string, decimal> { ["CHF"] = 0.95m }));

        var svc = CreateService();
        await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);
        await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);

        await _frankfurter.Received(1).GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetRate_ThrowsWhenNoCache_AndFrankfurterFails()
    {
        _frankfurter.GetLatest(Arg.Any<SupportedCurrency>(), Arg.Any<SupportedCurrency>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("timeout"));

        var svc = CreateService();
        var act = async () => await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);

        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.Code == ErrorCodes.CurrencyRateFetchFailed);
    }

    [Fact]
    public async Task GetRate_ReturnsStaleCache_WhenFrankfurterFails()
    {
        var staleDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2));
        _frankfurter.GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult(new FrankfurterResponse("EUR", staleDate, new Dictionary<string, decimal> { ["CHF"] = 0.90m })));

        var svc = CreateService();
        await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);

        // Second call hits cache — Frankfurter only called once.
        await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);
        await _frankfurter.Received(1).GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetRate_ThrowsOnInvalidRate()
    {
        _frankfurter.GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>())
            .Returns(new FrankfurterResponse("EUR", DateOnly.FromDateTime(DateTime.UtcNow),
                new Dictionary<string, decimal> { ["CHF"] = 0m }));

        var svc = CreateService();
        var act = async () => await svc.GetRate(SupportedCurrency.EUR, SupportedCurrency.CHF);

        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.Code == ErrorCodes.CurrencyRateFetchFailed);
    }

    // ===== ComputeOverride — ValidateFxMetadata =====

    [Fact]
    public async Task ComputeOverride_InvalidExchangeRate_Throws()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(originalCurrency: SupportedCurrency.EUR, targetCurrency: SupportedCurrency.CHF, exchangeRate: -1m);

        var act = async () => await svc.ComputeOverride(carrier);
        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.Code == ErrorCodes.CurrencyInvalidFxMetadata);
    }

    [Fact]
    public async Task ComputeOverride_ZeroExchangeRate_Throws()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(originalCurrency: SupportedCurrency.EUR, targetCurrency: SupportedCurrency.CHF, exchangeRate: 0m);

        var act = async () => await svc.ComputeOverride(carrier);
        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.Code == ErrorCodes.CurrencyInvalidFxMetadata);
    }

    // ===== Branch A: same-currency =====

    [Fact]
    public async Task BranchA_SameCurrency_NullsSourceFields()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(
            originalAmount: 100m,
            originalCurrency: SupportedCurrency.CHF,
            targetCurrency: SupportedCurrency.CHF,
            exchangeRate: 1m);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.OriginalCurrency.Should().BeNull();
        result.ExchangeRate.Should().BeNull();
        result.TargetCurrency.Should().Be(SupportedCurrency.CHF);
        result.OriginalAmountChanged.Should().BeTrue();
        result.OriginalCurrencyChanged.Should().BeTrue();
        result.TargetCurrencyChanged.Should().BeTrue();
        result.ExchangeRateChanged.Should().BeTrue();
    }

    [Fact]
    public async Task BranchA_SameCurrencyEUR_NullsSourceFields()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(
            originalCurrency: SupportedCurrency.EUR,
            targetCurrency: SupportedCurrency.EUR);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.OriginalCurrency.Should().BeNull();
        result.ExchangeRate.Should().BeNull();
        result.TargetCurrency.Should().Be(SupportedCurrency.EUR);
    }

    // ===== Branch B: incomplete pair =====

    [Fact]
    public async Task BranchB_OnlyTargetCurrency_NullsSourceFieldsChangedFlags()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(targetCurrency: SupportedCurrency.CHF);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.OriginalCurrency.Should().BeNull();
        result.ExchangeRate.Should().BeNull();
        result.TargetCurrency.Should().Be(SupportedCurrency.CHF);
        result.OriginalAmountChanged.Should().BeTrue(); // target touched → wipe source
        result.OriginalCurrencyChanged.Should().BeTrue();
        result.TargetCurrencyChanged.Should().BeTrue();
        result.ExchangeRateChanged.Should().BeTrue();
    }

    [Fact]
    public async Task BranchB_OnlyOriginalCurrency_NullsAll()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(originalCurrency: SupportedCurrency.EUR);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.OriginalCurrency.Should().BeNull();
        result.TargetCurrency.Should().BeNull();
        result.ExchangeRate.Should().BeNull();
        result.OriginalAmountChanged.Should().BeTrue();
        result.OriginalCurrencyChanged.Should().BeTrue();
        result.TargetCurrencyChanged.Should().BeFalse(); // target not sent
        result.ExchangeRateChanged.Should().BeTrue();
    }

    [Fact]
    public async Task BranchB_OnlyOriginalAmount_NullsSourceFields()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(originalAmount: 50m);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.OriginalCurrency.Should().BeNull();
        result.ExchangeRate.Should().BeNull();
        result.OriginalAmountChanged.Should().BeTrue();
        result.OriginalCurrencyChanged.Should().BeTrue();
        result.TargetCurrencyChanged.Should().BeFalse();
        result.ExchangeRateChanged.Should().BeTrue();
    }

    [Fact]
    public async Task BranchB_NoFxFieldsTouched_AllChangedFalse()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(); // nothing touched

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmountChanged.Should().BeFalse();
        result.OriginalCurrencyChanged.Should().BeFalse();
        result.TargetCurrencyChanged.Should().BeFalse();
        result.ExchangeRateChanged.Should().BeFalse();
    }

    [Fact]
    public async Task BranchB_OnlyExchangeRate_NullsSourceFields()
    {
        var svc = CreateService();
        var carrier = MakeCarrier(exchangeRate: 1.5m);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.OriginalCurrency.Should().BeNull();
        result.ExchangeRate.Should().BeNull();
        result.OriginalAmountChanged.Should().BeTrue();
        result.ExchangeRateChanged.Should().BeTrue();
        result.TargetCurrencyChanged.Should().BeFalse();
    }

    // ===== Branch C: full pair, different currencies =====

    [Fact]
    public async Task BranchC_FullPair_FetchesRateAndSetsAllFields()
    {
        _frankfurter.GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>())
            .Returns(new FrankfurterResponse("EUR", DateOnly.FromDateTime(DateTime.UtcNow),
                new Dictionary<string, decimal> { ["CHF"] = 0.95m }));

        var svc = CreateService();
        var carrier = MakeCarrier(
            originalAmount: 100m,
            originalCurrency: SupportedCurrency.EUR,
            targetCurrency: SupportedCurrency.CHF);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().Be(100m);
        result.OriginalCurrency.Should().Be(SupportedCurrency.EUR);
        result.TargetCurrency.Should().Be(SupportedCurrency.CHF);
        result.ExchangeRate.Should().Be(0.95m);
        result.OriginalAmountChanged.Should().BeTrue();
        result.OriginalCurrencyChanged.Should().BeTrue();
        result.TargetCurrencyChanged.Should().BeTrue();
        result.ExchangeRateChanged.Should().BeTrue();
    }

    [Fact]
    public async Task BranchC_NoOriginalAmount_StillSetsRateAndCurrencies()
    {
        _frankfurter.GetLatest(SupportedCurrency.EUR, SupportedCurrency.CHF, Arg.Any<CancellationToken>())
            .Returns(new FrankfurterResponse("EUR", DateOnly.FromDateTime(DateTime.UtcNow),
                new Dictionary<string, decimal> { ["CHF"] = 1.05m }));

        var svc = CreateService();
        var carrier = MakeCarrier(
            originalCurrency: SupportedCurrency.EUR,
            targetCurrency: SupportedCurrency.CHF);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalAmount.Should().BeNull();
        result.ExchangeRate.Should().Be(1.05m);
    }

    [Fact]
    public async Task BranchC_InversePair_CHFtoEUR()
    {
        _frankfurter.GetLatest(SupportedCurrency.CHF, SupportedCurrency.EUR, Arg.Any<CancellationToken>())
            .Returns(new FrankfurterResponse("CHF", DateOnly.FromDateTime(DateTime.UtcNow),
                new Dictionary<string, decimal> { ["EUR"] = 1.05m }));

        var svc = CreateService();
        var carrier = MakeCarrier(
            originalAmount: 200m,
            originalCurrency: SupportedCurrency.CHF,
            targetCurrency: SupportedCurrency.EUR);

        var result = await svc.ComputeOverride(carrier);

        result.OriginalCurrency.Should().Be(SupportedCurrency.CHF);
        result.TargetCurrency.Should().Be(SupportedCurrency.EUR);
        result.ExchangeRate.Should().Be(1.05m);
    }

    [Fact]
    public async Task BranchC_FrankfurterFails_ThrowsBusinessException()
    {
        _frankfurter.GetLatest(Arg.Any<SupportedCurrency>(), Arg.Any<SupportedCurrency>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("timeout"));

        var svc = CreateService();
        var carrier = MakeCarrier(
            originalCurrency: SupportedCurrency.EUR,
            targetCurrency: SupportedCurrency.CHF);

        var act = async () => await svc.ComputeOverride(carrier);
        await act.Should().ThrowAsync<BusinessException>()
            .Where(ex => ex.Code == ErrorCodes.CurrencyRateFetchFailed);
    }

    // ===== Helpers =====

    private static IFxCarrier MakeCarrier(
        decimal? originalAmount = null,
        SupportedCurrency? originalCurrency = null,
        SupportedCurrency? targetCurrency = null,
        decimal? exchangeRate = null)
    {
        var carrier = Substitute.For<IFxCarrier>();
        carrier.OriginalAmount.Returns(originalAmount);
        carrier.OriginalCurrency.Returns(originalCurrency);
        carrier.TargetCurrency.Returns(targetCurrency);
        carrier.ExchangeRate.Returns(exchangeRate);
        return carrier;
    }
}
