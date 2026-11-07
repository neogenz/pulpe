import SwiftUI

/// One month of a spread window (V2 `mtile`): its short name over the tranche it carries.
/// Selected → green wash; skipped → outlined, name struck, no amount.
struct MonthAmountTile: View {
    let label: String
    /// `nil` when the month is skipped.
    let amount: Decimal?
    let currency: SupportedCurrency

    private var isOn: Bool { amount != nil }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxs) {
            Text(label)
                .font(PulpeTypography.metricLabel)
                .strikethrough(!isOn, color: Color.textTertiary)
            Text(amount.map { $0.asAmount(for: currency) } ?? " ")
                .font(PulpeTypography.rowAmount)
                .sensitiveAmount()
        }
        .lineLimit(1)
        .minimumScaleFactor(DesignTokens.TextScale.floor)
        .foregroundStyle(isOn ? Color.accentInk : Color.textTertiary)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        .background(isOn ? Color.accentWash : Color.clear, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
                .strokeBorder(isOn ? Color.accentInk : Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.thin)
        }
    }
}

#Preview {
    HStack {
        MonthAmountTile(label: "nov. 26", amount: 120, currency: .chf)
        MonthAmountTile(label: "déc. 26", amount: nil, currency: .chf)
    }
    .padding()
    .pulpeBackground()
}
