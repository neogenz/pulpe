import SwiftUI

/// Segmented control for selecting input currency in amount forms.
/// Shown only when `showCurrencySelector` is enabled in user settings.
struct CurrencyAmountPicker: View {
    @Binding var selectedCurrency: SupportedCurrency
    let baseCurrency: SupportedCurrency

    private var currencies: [SupportedCurrency] {
        let options = SupportedCurrency.allCases
        // Ensure base currency is first
        if let index = options.firstIndex(of: baseCurrency), index != 0 {
            return [baseCurrency] + options.filter { $0 != baseCurrency }
        }
        return options
    }

    var body: some View {
        Picker("Devise", selection: $selectedCurrency) {
            ForEach(currencies) { currency in
                Text(currency.rawValue).tag(currency)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityLabel("Sélection de la devise")
    }
}

#Preview {
    @Previewable @State var currency: SupportedCurrency = .chf

    CurrencyAmountPicker(selectedCurrency: $currency, baseCurrency: .chf)
        .padding()
}
