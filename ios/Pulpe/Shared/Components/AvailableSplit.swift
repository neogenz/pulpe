import SwiftUI

/// Where a month's money goes (V2 hero split): one bar (Dépenses ocre / Épargne green /
/// Disponible ink) and its three-column legend. Shared by the budget hero and the model hero.
struct AvailableSplit: View {
    let expenses: Decimal
    let savings: Decimal
    let available: Decimal
    let currency: SupportedCurrency

    private struct Part {
        let label: String
        let amount: Decimal
        let color: Color
    }

    private var parts: [Part] {
        [
            Part(label: AppLocale.string("Dépenses"), amount: expenses, color: .financialExpense),
            Part(label: AppLocale.string("Épargne"), amount: savings, color: .financialSavings),
            Part(label: AppLocale.string("Disponible"), amount: available, color: .textPrimary),
        ]
    }

    private var segments: [SegmentedBar.Segment] {
        let shares = parts.map { max($0.amount, 0) }
        let whole = shares.reduce(0, +)
        guard whole > 0 else { return [] }
        return zip(shares, parts).map { share, part in
            SegmentedBar.Segment(
                fraction: Double(truncating: (share / whole) as NSDecimalNumber),
                color: part.color
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            SegmentedBar(segments: segments, trackColor: .sunk, height: DesignTokens.ProgressBar.thickHeight)
            legend
        }
    }

    private var legend: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            ForEach(parts, id: \.label) { part in
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Circle()
                            .fill(part.color)
                            .frame(
                                width: DesignTokens.ChipMetrics.stateDotSize,
                                height: DesignTokens.ChipMetrics.stateDotSize
                            )
                            .accessibilityHidden(true)
                        Text(part.label)
                            .font(PulpeTypography.captionRegular)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(1)
                    }
                    Text(verbatim: part.amount.asAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(Color.textPrimary)
                        .monospacedDigit()
                        .lineLimit(1)
                        .minimumScaleFactor(DesignTokens.TextScale.compact)
                        .sensitiveAmount()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityElement(children: .combine)
            }
        }
    }
}

#Preview {
    AvailableSplit(expenses: 2806.80, savings: 1088, available: 1217.20, currency: .chf)
        .padding()
        .background(Color.appBackground)
}
