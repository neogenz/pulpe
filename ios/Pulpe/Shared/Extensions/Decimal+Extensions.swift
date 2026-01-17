import Foundation

extension Decimal {
    /// Format as CHF currency using Swiss locale
    var asCHF: String {
        formatted(.currency(code: "CHF").locale(Locale(identifier: "de_CH")))
    }

    /// Format as compact CHF (no decimals for whole numbers)
    var asCompactCHF: String {
        let formatter = isWholeNumber ? Formatters.chfWholeNumber : Formatters.chfCompact
        return formatter.string(from: self as NSDecimalNumber) ?? asCHF
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

// MARK: - Optional Decimal Helpers

extension Optional where Wrapped == Decimal {
    /// Safely get value or zero
    var orZero: Decimal {
        self ?? .zero
    }

    /// Format as CHF, or return placeholder if nil
    func asCHF(placeholder: String = "-") -> String {
        self?.asCHF ?? placeholder
    }
}
