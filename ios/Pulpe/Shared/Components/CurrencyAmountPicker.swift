import SwiftUI

/// Segmented control for selecting input currency in amount forms.
/// Shown only when `showCurrencySelector` is enabled in user settings.
struct CurrencyAmountPicker: View {
    @Binding var selectedCurrency: String
    let baseCurrency: String

    private var currencies: [String] {
        let options = ["CHF", "EUR"]
        // Ensure base currency is first
        if let index = options.firstIndex(of: baseCurrency), index != 0 {
            return [baseCurrency] + options.filter { $0 != baseCurrency }
        }
        return options
    }

    var body: some View {
        Picker("Devise", selection: $selectedCurrency) {
            ForEach(currencies, id: \.self) { currency in
                Text(currency).tag(currency)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityLabel("Sélection de la devise")
    }
}

#Preview {
    @Previewable @State var currency = "CHF"

    CurrencyAmountPicker(selectedCurrency: $currency, baseCurrency: "CHF")
        .padding()
}
