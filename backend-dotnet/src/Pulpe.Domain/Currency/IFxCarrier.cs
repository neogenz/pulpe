namespace Pulpe.Domain.Currency;

/// <summary>
/// Marker interface for DTOs carrying FX metadata fields.
/// Application-layer DTOs use decrypted decimal? for OriginalAmount.
/// </summary>
public interface IFxCarrier
{
    decimal? OriginalAmount { get; }
    SupportedCurrency? OriginalCurrency { get; }  // Currency = Pulpe.Domain.Currency.Currency enum
    SupportedCurrency? TargetCurrency { get; }
    decimal? ExchangeRate { get; }
}
