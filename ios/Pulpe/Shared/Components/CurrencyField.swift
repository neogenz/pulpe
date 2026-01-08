import SwiftUI

/// Text field for currency input with CHF formatting
struct CurrencyField: View {
    @Binding var value: Decimal?
    let placeholder: String
    let label: String?

    @FocusState private var internalFocus: Bool
    @State private var textValue: String = ""

    private let externalFocus: FocusState<Bool>.Binding?

    private var effectiveFocus: Bool {
        externalFocus?.wrappedValue ?? internalFocus
    }

    init(
        value: Binding<Decimal?>,
        placeholder: String = "0.00",
        label: String? = nil,
        externalFocus: FocusState<Bool>.Binding? = nil
    ) {
        self._value = value
        self.placeholder = placeholder
        self.label = label
        self.externalFocus = externalFocus
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let label {
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            HStack {
                Text("CHF")
                    .foregroundStyle(.secondary)
                    .font(.body)

                TextField(placeholder, text: $textValue)
                    .keyboardType(.decimalPad)
                    .focused(externalFocus ?? $internalFocus)
                    .onChange(of: textValue) { _, newValue in
                        updateValue(from: newValue)
                    }
                    .onChange(of: value) { _, newValue in
                        updateText(from: newValue)
                    }
            }
            .padding()
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(effectiveFocus ? Color.accentColor : Color.secondary.opacity(0.3), lineWidth: 1)
            )
        }
        .onAppear {
            updateText(from: value)
        }
    }

    private func updateValue(from text: String) {
        // Remove non-numeric characters except decimal separator
        let cleanedText = text
            .replacingOccurrences(of: ",", with: ".")
            .filter { $0.isNumber || $0 == "." }

        // Ensure only one decimal point
        let components = cleanedText.split(separator: ".")
        let sanitized: String
        if components.count > 1 {
            sanitized = "\(components[0]).\(components.dropFirst().joined())"
        } else {
            sanitized = cleanedText
        }

        if let decimal = Decimal(string: sanitized) {
            value = decimal
        } else if sanitized.isEmpty {
            value = nil
        }
    }

    private func updateText(from decimal: Decimal?) {
        guard let decimal else {
            if !effectiveFocus {
                textValue = ""
            }
            return
        }

        // Only update if not focused (avoid cursor jumping)
        if !effectiveFocus {
            let formatter = NumberFormatter()
            formatter.numberStyle = .decimal
            formatter.minimumFractionDigits = 0
            formatter.maximumFractionDigits = 2
            formatter.groupingSeparator = ""
            textValue = formatter.string(from: decimal as NSDecimalNumber) ?? ""
        }
    }
}

/// Compact currency display for read-only values
struct CurrencyText: View {
    let amount: Decimal
    let showSign: Bool
    let style: TextStyle

    enum TextStyle {
        case title
        case body
        case caption
    }

    init(_ amount: Decimal, showSign: Bool = false, style: TextStyle = .body) {
        self.amount = amount
        self.showSign = showSign
        self.style = style
    }

    var body: some View {
        Text(formattedAmount)
            .font(font)
    }

    private var font: Font {
        switch style {
        case .title: .title2.weight(.semibold)
        case .body: .body
        case .caption: .caption
        }
    }

    private var formattedAmount: String {
        let style = Decimal.FormatStyle.Currency(code: "CHF")
            .sign(strategy: showSign ? .always() : .automatic)
        return amount.formatted(style)
    }
}

#Preview {
    VStack(spacing: 20) {
        CurrencyField(
            value: .constant(1234.56),
            label: "Montant"
        )

        CurrencyField(
            value: .constant(nil),
            placeholder: "0.00",
            label: "Montant optionnel"
        )

        VStack {
            CurrencyText(5000, style: .title)
            CurrencyText(-1234.56, showSign: true)
            CurrencyText(42.50, style: .caption)
        }
    }
    .padding()
}
