import SwiftUI

/// Capsule pill selector for choosing input currency in amount forms.
/// Shown only when `showCurrencySelector` is enabled in user settings.
struct CurrencyAmountPicker: View {
    @Binding var selectedCurrency: SupportedCurrency
    /// Kept for source compatibility with existing call sites. Currently unused.
    let baseCurrency: SupportedCurrency

    var body: some View {
        CapsulePicker(selection: $selectedCurrency, title: "Devise") { currency, _ in
            HStack(spacing: DesignTokens.Spacing.xs) {
                Text(currency.flag)
                Text(currency.rawValue)
            }
        }
        .accessibilityLabel("Sélection de la devise")
    }
}

#Preview {
    @Previewable @State var currency: SupportedCurrency = .chf

    CurrencyAmountPicker(selectedCurrency: $currency, baseCurrency: .chf)
        .padding()
}
