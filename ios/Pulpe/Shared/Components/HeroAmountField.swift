import SwiftUI

private let heroAmountUnderlineWidth: CGFloat = 120

/// Reusable hero amount input field used across all sheet forms.
/// Uses a hidden TextField for keyboard input with an animated visible display.
struct HeroAmountField<Field: Hashable>: View {
    @Binding var amount: Decimal?
    @Binding var amountText: String
    var focus: FocusState<Field?>.Binding
    var field: Field
    var hint: String?
    var currency: SupportedCurrency = .chf
    var accentColor: Color = .pulpePrimary

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Formatters.amountInput.string(from: amount as NSDecimalNumber) ?? "0.00"
        }
        return "0.00"
    }

    private var isFieldFocused: Bool {
        focus.wrappedValue == field
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(currency.symbol)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.onSurfaceVariant)

            ZStack {
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused(focus, equals: field)
                    .opacity(0)
                    .frame(width: 0, height: 0)
                    .onChange(of: amountText) { _, newValue in
                        if let value = newValue.parsedAsAmount {
                            amount = value
                        } else {
                            amount = nil
                        }
                    }

                Text(displayAmount)
                    .font(PulpeTypography.amountHero)
                    .foregroundStyle((amount ?? 0) > 0 ? Color.textPrimary : Color.textTertiary)
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
            }

            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.hairline)
                .fill(
                    isFieldFocused
                        ? accentColor
                        : Color.outline.opacity(0.4)
                )
                .frame(width: heroAmountUnderlineWidth, height: DesignTokens.BorderWidth.thick)
                .animation(DesignTokens.Animation.smoothEaseInOut, value: isFieldFocused)

            if let hint, (amount ?? 0) <= 0 {
                Text(hint)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.lg)
        .contentShape(Rectangle())
        // Same pattern as `FormTextField` / `CurrencyField`: tap anywhere to focus the amount field.
        .onTapGesture { focus.wrappedValue = field }
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Montant")
        .animation(DesignTokens.Animation.smoothEaseInOut, value: amount)
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
