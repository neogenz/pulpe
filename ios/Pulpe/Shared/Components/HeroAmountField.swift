import SwiftUI

/// Reusable hero amount input field used across all sheet forms.
/// Uses a hidden TextField for keyboard input with an animated visible display.
struct HeroAmountField: View {
    @Binding var amount: Decimal?
    @Binding var amountText: String
    var isFocused: FocusState<Bool>.Binding
    var hint: String?
    var accentColor: Color = .pulpePrimary

    private var displayAmount: String {
        if let amount, amount > 0 {
            return Formatters.amountInput.string(from: amount as NSDecimalNumber) ?? "0.00"
        }
        return "0.00"
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text(DesignTokens.AmountInput.currencyCode)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.onSurfaceVariant)

            ZStack {
                TextField("", text: $amountText)
                    .keyboardType(.decimalPad)
                    .focused(isFocused)
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
                    isFocused.wrappedValue
                        ? accentColor
                        : Color.outline.opacity(0.4)
                )
                .frame(width: 120, height: 2)
                .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: isFocused.wrappedValue)

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
        .onTapGesture { isFocused.wrappedValue = true }
        .accessibilityAddTraits(.isButton)
        .accessibilityLabel("Montant")
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: amount)
    }
}

#Preview {
    @Previewable @State var amount: Decimal?
    @Previewable @State var amountText = ""
    @Previewable @FocusState var isFocused: Bool

    HeroAmountField(
        amount: $amount,
        amountText: $amountText,
        isFocused: $isFocused,
        hint: "Quel montant ?"
    )
}
