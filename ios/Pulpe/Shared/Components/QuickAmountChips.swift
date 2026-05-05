import SwiftUI

/// Reusable quick amount chip buttons used across sheet forms.
/// Internalizes the `pendingQuickAmount` state and focus transition logic for applying chip values.
struct QuickAmountChips<Field: Hashable>: View {
    @Binding var amount: Decimal?
    @Binding var amountText: String
    var focus: FocusState<Field?>.Binding
    var amountField: Field
    var color: Color = .pulpePrimary
    var currency: SupportedCurrency = .chf

    @State private var pendingQuickAmount: Int?
    @State private var selectionTrigger = false

    private let quickAmounts = DesignTokens.AmountInput.quickAmounts

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(quickAmounts, id: \.self) { quickAmount in
                let isSelected = amount == Decimal(quickAmount)
                Button {
                    selectionTrigger.toggle()
                    if focus.wrappedValue == amountField {
                        pendingQuickAmount = quickAmount
                        focus.wrappedValue = nil
                    } else {
                        amount = Decimal(quickAmount)
                        amountText = "\(quickAmount)"
                    }
                } label: {
                    Text("\(quickAmount) \(currency.symbol)")
                        .font(PulpeTypography.labelLarge)
                        .fixedSize()
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(Color.surfaceContainer)
                        .foregroundStyle(isSelected ? color : Color.onSurfaceVariant)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().strokeBorder(
                                isSelected
                                    ? color.opacity(DesignTokens.Opacity.strong)
                                    : Color.outlineVariant.opacity(0.6),
                                lineWidth: DesignTokens.BorderWidth.thin
                            )
                        )
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Capsule())
                .plainPressedButtonStyle()
                .accessibilityHint("Définir le montant à \(quickAmount) \(currency.rawValue)")
            }
        }
        .sensoryFeedback(.selection, trigger: selectionTrigger)
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
        .onChange(of: focus.wrappedValue) { oldValue, newValue in
            if oldValue == amountField, newValue != amountField, let quickAmount = pendingQuickAmount {
                amount = Decimal(quickAmount)
                amountText = "\(quickAmount)"
                pendingQuickAmount = nil
            }
        }
    }
}

private enum QuickAmountChipsPreviewField: Hashable {
    case amount
}

#Preview {
    @Previewable @State var amount: Decimal?
    @Previewable @State var amountText = ""
    @Previewable @FocusState var focusedField: QuickAmountChipsPreviewField?

    QuickAmountChips(
        amount: $amount,
        amountText: $amountText,
        focus: $focusedField,
        amountField: .amount,
        color: .pulpePrimary
    )
    .padding()
}
