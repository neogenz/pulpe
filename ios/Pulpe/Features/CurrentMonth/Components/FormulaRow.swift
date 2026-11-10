import SwiftUI

/// One line of a formula card (V2 `frow`): a name, an optional caption under it, the figure on
/// the trailing edge. The total line closes the card in bold. Used by « Le calcul » and the
/// month's « Bilan », whose cards both add up to the figure shown above them.
struct FormulaRow: View {
    let title: String
    var caption: String?
    let amount: String
    var tint: Color = .textPrimary
    var isTotal = false

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(title)
                    .font(isTotal ? PulpeTypography.rowTitle : PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textPrimary)
                if let caption {
                    Text(caption)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .sensitiveAmount()
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .fixedSize(horizontal: false, vertical: true)

            Text(verbatim: amount)
                .font(isTotal ? PulpeTypography.totalAmount : PulpeTypography.rowAmount)
                .foregroundStyle(tint)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
                .layoutPriority(1)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.sm)
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .accessibilityElement(children: .combine)
    }
}

extension Decimal {
    /// "+6'200.00" / "−4'197.00" / "0.00": a line of a formula, signed by its own value and
    /// written without the unit the figure above already carries.
    func asFormulaAmount(for currency: SupportedCurrency) -> String {
        let magnitude = absoluteValue.asAmount(for: currency)
        if self > 0 { return "+\(magnitude)" }
        if self < 0 { return "\u{2212}\(magnitude)" }
        return magnitude
    }
}
