import SwiftUI

/// The amount a sheet asks for, typed as the hero figure (V2 `hero-num`): Manrope 800 52pt in
/// ink, a green caret while focused, the currency as a suffix, a caption under it.
/// A hidden TextField takes the keyboard input; the visible figure animates its digits.
struct HeroAmountField<Field: Hashable>: View {
    @Binding var amount: Decimal?
    @Binding var amountText: String
    var focus: FocusState<Field?>.Binding
    var field: Field
    /// Caption under the figure while it is empty ("Quel montant ?").
    var hint: String?
    var currency: SupportedCurrency = .chf
    /// Caption under the figure once it holds an amount ("prévus en novembre · avant 600.00").
    var caption: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var hasAmount: Bool { (amount ?? 0) > 0 }

    private var displayAmount: String {
        guard let amount, amount > 0 else { return "0.00" }
        return Formatters.amountInput(for: currency).string(from: amount as NSDecimalNumber) ?? "0.00"
    }

    private var isFieldFocused: Bool {
        focus.wrappedValue == field
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            ZStack {
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused(focus, equals: field)
                    .opacity(0)
                    .frame(width: 0, height: 0)
                    .onChange(of: amountText) { _, newValue in
                        amount = newValue.parsedAsAmount
                    }

                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.none) {
                    Text(displayAmount)
                        .font(PulpeTypography.heroAmount)
                        .tracking(DesignTokens.Tracking.heroV2)
                        .foregroundStyle(hasAmount ? Color.textPrimary : Color.textTertiary)
                        .contentTransition(.numericText())
                        .lineLimit(1)
                        .minimumScaleFactor(DesignTokens.TextScale.floor)

                    Rectangle()
                        .fill(Color.pulpePrimary)
                        .frame(width: DesignTokens.BorderWidth.thick, height: DesignTokens.Control.heroCaretHeight)
                        .padding(.leading, DesignTokens.Spacing.xxs)
                        .alignmentGuide(.firstTextBaseline) { $0[.bottom] - DesignTokens.Control.heroCaretDescent }
                        .opacity(isFieldFocused ? 1 : 0)
                        .accessibilityHidden(true)

                    Text(currency.symbol)
                        .font(PulpeTypography.heroCurrencySuffix)
                        .foregroundStyle(Color.textSecondary)
                        .padding(.leading, DesignTokens.Spacing.xs)
                }
                .animation(reduceMotion ? nil : .snappy(duration: DesignTokens.Animation.fast), value: amount)
            }

            if let hint, !hasAmount {
                Text(hint)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textTertiary)
                    .transition(.opacity)
            } else if let caption, hasAmount {
                Text(caption)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
                    .sensitiveAmount()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .contentShape(Rectangle())
        // Same pattern as `FormTextField` / `CurrencyField`: tap anywhere to focus the amount field.
        .onTapGesture { focus.wrappedValue = field }
        .accessibilityElement(children: .ignore)
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel(AppLocale.string("Montant"))
        .accessibilityValue(
            hasAmount
                ? ["\(displayAmount) \(currency.symbol)", caption].compactMap(\.self).joined(separator: ", ")
                : (hint ?? "")
        )
        .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseInOut, value: hasAmount)
    }
}

private enum HeroAmountFieldPreviewField: Hashable {
    case amount
}

#Preview {
    @Previewable @State var amount: Decimal?
    @Previewable @State var amountText = ""
    @Previewable @FocusState var focusedField: HeroAmountFieldPreviewField?

    HeroAmountField(
        amount: $amount,
        amountText: $amountText,
        focus: $focusedField,
        field: .amount,
        hint: "Quel montant ?"
    )
}
