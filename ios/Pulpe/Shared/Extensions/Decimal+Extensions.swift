import Foundation

extension Decimal {
    /// Format as currency with the currency's display symbol in suffix position —
    /// `1'234.56 CHF` / `1 234,56 €`. Uses the currency's locale for number
    /// formatting (separators, decimals). Swiss convention keeps the `CHF` code;
    /// EUR uses `€` for naturalness — see `SupportedCurrency.symbol`.
    func asCurrency(_ currency: SupportedCurrency) -> String {
        "\(asAmount(for: currency)) \(currency.symbol)"
    }

    /// Format as CHF currency using Swiss locale
    var asCHF: String { asCurrency(.chf) }

    /// Format as amount only (no currency symbol) using the currency's locale.
    /// EUR → `1 234,56`, CHF → `1'234.56` (U+2019 typographic apostrophe — see PUL-125).
    func asAmount(for currency: SupportedCurrency) -> String {
        let formatter = Formatters.amountFormatter(for: currency)
        return formatter.string(from: self as NSDecimalNumber) ?? "0.00"
    }

    /// Format as signed amount (no currency symbol) using the currency's locale.
    func asSignedAmount(for kind: TransactionKind, in currency: SupportedCurrency) -> String {
        signedFormatted(absoluteValue.asAmount(for: currency), for: kind)
    }

    /// Format as signed currency based on transaction kind — "+1'234.56 CHF" for income,
    /// "-1 234,56 €" for expense/saving, locale-aware.
    func asSignedCurrency(_ currency: SupportedCurrency, for kind: TransactionKind) -> String {
        signedFormatted(absoluteValue.asCurrency(currency), for: kind)
    }

    /// Format as signed CHF based on transaction kind — "+1'234.56 CHF" for income, "-1'234.56 CHF" for expense/saving
    func asSignedCHF(for kind: TransactionKind) -> String {
        signedFormatted(absoluteValue.asCHF, for: kind)
    }

    /// Format as signed compact CHF based on transaction kind — "+1'235 CHF" for income, "-1'235 CHF" for expense/saving
    func asSignedCompactCHF(for kind: TransactionKind) -> String {
        signedFormatted(absoluteValue.asCompactCHF, for: kind)
    }

    /// Format as signed compact currency based on transaction kind — "+1'235 CHF" for income, "-1 235 €" for expense/saving
    func asSignedCompactCurrency(_ currency: SupportedCurrency, for kind: TransactionKind) -> String {
        signedFormatted(absoluteValue.asCompactCurrency(currency), for: kind)
    }

    /// Format as compact amount only (no currency code, rounded to whole number) using the currency's locale.
    /// EUR → `1 235`, CHF → `1'235` (U+2019 typographic apostrophe — see PUL-125).
    func asCompactAmount(for currency: SupportedCurrency) -> String {
        let formatter = Formatters.amountFormatter(for: currency, wholeNumber: true)
        return formatter.string(from: self as NSDecimalNumber) ?? "0"
    }

    /// Format as compact currency (rounded to whole number) using the currency's locale.
    /// EUR → `1 235 €`, CHF → `1'235 CHF`.
    func asCompactCurrency(_ currency: SupportedCurrency) -> String {
        "\(asCompactAmount(for: currency)) \(currency.symbol)"
    }

    /// Format as compact CHF (always rounded to whole number) — "1'235 CHF" (suffix position)
    var asCompactCHF: String {
        asCompactCurrency(.chf)
    }

    /// Format as signed CHF — "+1'234.56 CHF" for positive, "-1'234.56 CHF" for negative, "0.00 CHF" for zero.
    /// Sign reflects the value's sign — for transaction-kind signing use `asSignedCHF(for:)`.
    var asSignedCHF: String {
        "\(signPrefix)\(asCHF)"
    }

    /// Format as arithmetic-signed currency — sign reflects the value's sign.
    /// Use for balances and totals where the sign is the math result.
    /// For transaction-kind signing (income vs expense/saving), prefer `asSignedCurrency(_:for:)`.
    func asArithmeticSignedCurrency(_ currency: SupportedCurrency) -> String {
        "\(signPrefix)\(asCurrency(currency))"
    }

    /// Format as signed compact amount only using the currency's locale.
    func asSignedCompactAmount(for currency: SupportedCurrency) -> String {
        "\(signPrefix)\(asCompactAmount(for: currency))"
    }

    /// Format as signed compact CHF — "+1'235 CHF" for positive, "-1'235 CHF" for negative, "0 CHF" for zero
    var asSignedCompactCHF: String {
        "\(signPrefix)\(asCompactCHF)"
    }

    /// Format as arithmetic-signed compact currency — sign reflects the value's sign.
    /// For transaction-kind signing, prefer `asSignedCompactCurrency(_:for:)`.
    func asArithmeticSignedCompactCurrency(_ currency: SupportedCurrency) -> String {
        "\(signPrefix)\(asCompactCurrency(currency))"
    }

    /// Check if the decimal is a whole number
    var isWholeNumber: Bool {
        self == self.rounded(0, .plain)
    }

    /// Round to specified decimal places
    func rounded(_ scale: Int, _ mode: NSDecimalNumber.RoundingMode = .plain) -> Decimal {
        var result = Decimal()
        var mutableSelf = self
        NSDecimalRound(&result, &mutableSelf, scale, mode)
        return result
    }

    /// Absolute value
    var absoluteValue: Decimal {
        self < 0 ? -self : self
    }

    /// Format as percentage
    func asPercentage(maximumFractionDigits: Int = 0) -> String {
        (self / 100).formatted(.percent.precision(.fractionLength(0...maximumFractionDigits)))
    }
}

private extension Decimal {
    var signPrefix: String {
        self > 0 ? "+" : ""
    }

    func signedFormatted(_ base: String, for kind: TransactionKind) -> String {
        switch kind {
        case .income: "+\(base)"
        case .expense, .saving: "-\(base)"
        }
    }
}

// MARK: - Amount Parsing

extension String {
    /// Parses user-typed amount text into a Decimal value.
    /// Supports comma as decimal separator and limits to 2 fractional digits.
    /// Returns the parsed Decimal, or nil for empty/invalid input.
    var parsedAsAmount: Decimal? {
        let cleaned = self
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }

        let components = cleaned.split(separator: ".")
        let sanitized: String
        if components.count > 1 {
            let fractional = String(components.dropFirst().joined().prefix(2))
            sanitized = "\(components[0]).\(fractional)"
        } else {
            sanitized = cleaned
        }

        return Decimal(string: sanitized)
    }
}

// MARK: - Optional Decimal Helpers

extension Optional where Wrapped == Decimal {
    /// Safely get value or zero
    var orZero: Decimal {
        self ?? .zero
    }

    /// Format as CHF, or return fallback if nil
    func asCHF(fallback: String = "-") -> String {
        self?.asCHF ?? fallback
    }
}
