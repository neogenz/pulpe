import SwiftUI

/// The hero's dominant figure: an eyebrow above, the amount and its currency suffix on
/// one baseline, an optional trailing suffix ("sur 2'500") in secondary ink.
struct HeroFigure: View {
    let eyebrow: String
    let amount: Decimal
    let currency: SupportedCurrency
    /// Shows a leading `+` on a positive amount (year balance, variance). Off by default:
    /// a `+` on money you still have reads as a variation, not a sum.
    var signed = false
    var suffix: String?
    var alignment: HorizontalAlignment = .center
    var accessibilityIdentifier: String?

    var body: some View {
        VStack(alignment: alignment, spacing: DesignTokens.Spacing.xs) {
            Text(eyebrow)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.heroInkSecondary)

            figure
                .monospacedDigit()
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .lineLimit(1)
                .foregroundStyle(Color.heroInk)
                .contentTransition(.numericText())
                .sensitiveAmount()
                .accessibilityIdentifier(accessibilityIdentifier ?? "")
        }
        .frame(maxWidth: .infinity, alignment: Alignment(horizontal: alignment, vertical: .center))
    }

    private var figure: Text {
        let sign = signed && amount > 0 ? "+" : ""
        let main = Text(verbatim: sign + amount.asAdaptiveAmount(for: currency))
            .font(PulpeTypography.dashboardHeroAmount)
            .tracking(DesignTokens.Tracking.hero)
            + Text(verbatim: " \(currency.symbol)")
            .font(PulpeTypography.dashboardHeroCurrency)
            .foregroundStyle(Color.heroInkSecondary)
        guard let suffix else { return main }
        return main + Text(verbatim: " \(suffix)")
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.heroInkSecondary)
    }
}
