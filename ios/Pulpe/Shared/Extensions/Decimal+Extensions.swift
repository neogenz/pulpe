import Foundation

extension Decimal {
    /// Format as currency using the appropriate locale
    func asCurrency(_ code: String) -> String {
        formatted(.currency(code: code).locale(Formatters.locale(for: code)))
    }

    /// Format as CHF currency using Swiss locale
    var asCHF: String { asCurrency("CHF") }

    /// Format as amount only (no currency code) using Swiss locale — "1'234.56"
    var asAmount: String {
        Self.amountFormatter.string(from: self as NSDecimalNumber) ?? "0.00"
    }

    /// Format as signed amount based on transaction kind — "+5'000.00" for income, "-1'500.00" for expense/saving
    func asSignedAmount(for kind: TransactionKind) -> String {
        let formatted = absoluteValue.asAmount
        switch kind {
        case .income: return "+\(formatted)"
        case .expense, .saving: return "-\(formatted)"
        }
    }

    /// Format as compact currency (no decimals for whole numbers)
    func asCompactCurrency(_ code: String) -> String {
        let formatter = isWholeNumber
            ? Formatters.currencyFormatter(code: code, wholeNumber: true)
            : Formatters.currencyFormatter(code: code)
        return formatter.string(from: self as NSDecimalNumber) ?? asCurrency(code)
    }

    /// Format as compact CHF (no decimals for whole numbers)
    var asCompactCHF: String { asCompactCurrency("CHF") }

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
    static let amountFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "de_CH")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()
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
