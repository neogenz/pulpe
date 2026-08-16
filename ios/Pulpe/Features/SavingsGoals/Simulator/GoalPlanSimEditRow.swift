import SwiftUI

/// One editable open-month row in the plan simulator (PUL-12+): month label +
/// running cumulative + an inline decimal field. A visible field is the only
/// affordance a non-tech parses in 3 s and is natively accessible — no drag-on-bar,
/// no steppers (`docs/SAVINGS.md` §10.1). Savings green + neutrals only.
///
/// Deliberately the same shape as `GoalPlanMonthRow`, which draws the locked
/// months of the same card: label and cumulative on the left, the amount alone on
/// the right. Two grammars in one list made the cumulative jump from column to
/// column between adjacent rows.
struct GoalPlanSimEditRow: View {
    let simMonth: SavingsPlanCalculator.SimulatedMonth
    let currency: SupportedCurrency
    @Binding var amount: Decimal

    @FocusState private var isFocused: Bool

    private var fieldShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.sm, style: .continuous)
    }

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                monthDescription
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: DesignTokens.Spacing.sm)
                amountEditor(width: 104)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                monthDescription
                    .fixedSize(horizontal: false, vertical: true)
                amountEditor(width: nil)
            }
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
    }

    private var monthDescription: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            // `String(year)`: interpolating an `Int` would apply localized grouping
            // and render « Août 2 026 ».
            Text("\(Formatters.monthName(for: simMonth.month.month)) \(String(simMonth.month.year))")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textPrimary)
            Text("→ \(simMonth.simulatedCumulative.asCompactCurrency(currency))")
                .font(PulpeTypography.labelMedium)
                .monospacedDigit()
                .foregroundStyle(Color.textTertiary)
                .sensitiveAmount()
        }
    }

    /// What tells an iOS reader a number is editable is a shape around it, so the
    /// field keeps its box — but tight to the value and outlined, where it used to
    /// be a slab with vertical padding on top of its own tap target and a plain
    /// body number rattling inside. The content leads, the box supports, and the
    /// outline turns accent on focus.
    private func amountEditor(width: CGFloat?) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
            TextField("", value: $amount, format: .number.precision(.fractionLength(0...2)))
                .keyboardType(.numbersAndPunctuation)
                .multilineTextAlignment(.trailing)
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .focused($isFocused)
                .frame(width: width)
                .frame(maxWidth: width == nil ? .infinity : nil)
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .accessibilityLabel(AppLocale.string("""
                    Mouvement de l’objectif, \
                    \(Formatters.monthName(for: simMonth.month.month)) \(String(simMonth.month.year))
                    """))
            Text(currency.symbol)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: width == nil ? .infinity : nil)
        .padding(.horizontal, DesignTokens.Spacing.sm)
        .background(Color.surfaceContainerHigh, in: fieldShape)
        .overlay {
            fieldShape.strokeBorder(
                isFocused ? Color.pulpePrimary : Color.outlineVariant,
                lineWidth: isFocused ? DesignTokens.BorderWidth.medium : DesignTokens.BorderWidth.hairline
            )
        }
        .animation(DesignTokens.Animation.quickEaseInOut, value: isFocused)
    }
}
