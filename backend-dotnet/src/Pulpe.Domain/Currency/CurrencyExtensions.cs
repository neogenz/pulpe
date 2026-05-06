namespace Pulpe.Domain.Currency;

public static class CurrencyExtensions
{
    public static string ToIsoCode(this SupportedCurrency currency) => currency.ToString();

    public static SupportedCurrency? FromIsoCode(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        return Enum.TryParse<SupportedCurrency>(code, ignoreCase: true, out var result) ? result : null;
    }
}
