import SwiftUI

/// Reusable quick amount chip buttons used across sheet forms.
/// Internalizes the `pendingQuickAmount` state and `onChange(of: isFocused)` logic.
struct QuickAmountChips: View {
    @Binding var amount: Decimal?
    @Binding var amountText: String
    var isFocused: FocusState<Bool>.Binding
    var color: Color = .pulpePrimary

    @State private var pendingQuickAmount: Int?
    @State private var selectionTrigger = false

    private let quickAmounts = DesignTokens.AmountInput.quickAmounts

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            ForEach(quickAmounts, id: \.self) { quickAmount in
                let isSelected = amount == Decimal(quickAmount)
                Button {
                    selectionTrigger.toggle()
                    if isFocused.wrappedValue {
                        pendingQuickAmount = quickAmount
                        isFocused.wrappedValue = false
                    } else {
                        amount = Decimal(quickAmount)
                        amountText = "\(quickAmount)"
                    }
                } label: {
                    Text("\(quickAmount) \(DesignTokens.AmountInput.currencyCode)")
                        .font(PulpeTypography.labelLarge)
                        .fixedSize()
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .frame(maxWidth: .infinity)
                        .background(Color.surfaceContainer)
                        .foregroundStyle(isSelected ? color : Color.textTertiary)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule().strokeBorder(
                                isSelected ? color.opacity(DesignTokens.Opacity.strong) : Color.clear,
                                lineWidth: 1
                            )
                        )
                }
                .buttonStyle(.plain)
                .accessibilityHint("Définir le montant à \(quickAmount) \(DesignTokens.AmountInput.currencyCode)")
            }
        }
        .sensoryFeedback(.selection, trigger: selectionTrigger)
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: amount)
        .onChange(of: isFocused.wrappedValue) { _, focused in
            if !focused, let quickAmount = pendingQuickAmount {
                amount = Decimal(quickAmount)
                amountText = "\(quickAmount)"
                pendingQuickAmount = nil
            }
        }
    }
}

#Preview {
    @Previewable @State var amount: Decimal?
    @Previewable @State var amountText = ""
    @Previewable @FocusState var isFocused: Bool

    QuickAmountChips(
        amount: $amount,
        amountText: $amountText,
        isFocused: $isFocused,
        color: .pulpePrimary
    )
    .padding()
}
