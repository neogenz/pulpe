import Foundation

extension Decimal {
    /// Format as CHF currency
    var asCHF: String {
        formatted(.currency(code: "CHF"))
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
        Formatters.percentage.maximumFractionDigits = maximumFractionDigits
        return Formatters.percentage.string(from: (self / 100) as NSDecimalNumber) ?? "\(self)%"
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
