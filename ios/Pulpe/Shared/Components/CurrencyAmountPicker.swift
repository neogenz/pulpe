import SwiftUI

/// Currency selector for amount forms.
/// When `isReadOnly` is `true`, renders a non-interactive capsule.
struct CurrencyAmountPicker: View {
    @Binding var selectedCurrency: SupportedCurrency
    var isReadOnly: Bool = false

    var body: some View {
        if isReadOnly {
            readOnlyCapsule
        } else {
            SegmentedPicker(selection: $selectedCurrency, title: AppLocale.string("Devise")) { currency in
                Text("\(currency.flag) \(currency.rawValue)")
            }
            // `.contain` before the label: without it, it propagates onto the segments
            // themselves and VoiceOver loses each currency's own name.
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Sélection de la devise")
        }
    }

    private var readOnlyCapsule: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(selectedCurrency.flag)
            Text(selectedCurrency.rawValue)
        }
        .font(PulpeTypography.buttonSecondary)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(Color.surfaceContainerHigh, in: Capsule())
        .foregroundStyle(Color.onSurfaceVariant)
        .opacity(DesignTokens.Opacity.heavy)
        .accessibilityLabel("Devise : \(selectedCurrency.rawValue) (non modifiable)")
    }
}

#Preview("Interactive") {
    @Previewable @State var currency: SupportedCurrency = .chf

    CurrencyAmountPicker(selectedCurrency: $currency)
        .padding()
}

#Preview("Read-only") {
    @Previewable @State var currency: SupportedCurrency = .eur

    CurrencyAmountPicker(selectedCurrency: $currency, isReadOnly: true)
        .padding()
}
