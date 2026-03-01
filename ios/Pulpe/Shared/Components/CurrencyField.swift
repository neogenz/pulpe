import SwiftUI

/// Text field for currency input with CHF formatting
struct CurrencyField: View {
    enum VisualStyle {
        case onboarding
        case flat
    }

    private static let displayFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.groupingSeparator = ""
        return formatter
    }()

    @Binding var value: Decimal?
    let hint: String
    let label: String?
    let visualStyle: VisualStyle

    @FocusState private var internalFocus: Bool
    @State private var textValue: String
    @State private var hasInitialized = false

    private let externalFocus: FocusState<Bool>.Binding?

    private var effectiveFocus: Bool {
        externalFocus?.wrappedValue ?? internalFocus
    }

    init(
        value: Binding<Decimal?>,
        hint: String = "0.00",
        label: String? = nil,
        visualStyle: VisualStyle = .onboarding,
        externalFocus: FocusState<Bool>.Binding? = nil
    ) {
        self._value = value
        self.hint = hint
        self.label = label
        self.visualStyle = visualStyle
        self.externalFocus = externalFocus

        // Initialize text value from binding immediately (not in onAppear)
        if let decimal = value.wrappedValue {
            self._textValue = State(initialValue: Self.displayFormatter.string(from: decimal as NSDecimalNumber) ?? "")
        } else {
            self._textValue = State(initialValue: "")
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if let label {
                Text(label)
                    .font(PulpeTypography.inputLabel)
                    .foregroundStyle(labelColor)
            }

            HStack {
                Text("CHF")
                    .foregroundStyle(prefixColor)
                    .font(PulpeTypography.bodyLarge)

                TextField(hint, text: $textValue)
                    .keyboardType(.decimalPad)
                    .foregroundStyle(Color.authInputText)
                    .focused(externalFocus ?? $internalFocus)
                    .accessibilityLabel(label ?? "Montant en CHF")
                    .onChange(of: textValue) { _, newValue in
                        updateValue(from: newValue)
                    }
                    .onChange(of: value) { _, newValue in
                        // Only update text if value changed externally (not from user input)
                        if hasInitialized {
                            updateText(from: newValue)
                        }
                    }
            }
            .padding(DesignTokens.Spacing.lg)
            .background {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(backgroundColor)
                    .overlay {
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(
                                effectiveFocus ? Color.pulpePrimary.opacity(0.6) : Color.authInputBorder,
                                lineWidth: effectiveFocus ? 2 : 1
                            )
                    }
            }
            .shadow(color: shadowColor, radius: shadowRadius, y: shadowYOffset)
            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: effectiveFocus)
        }
        .task {
            // Mark as initialized after first render
            hasInitialized = true
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
            textValue = Self.displayFormatter.string(from: decimal as NSDecimalNumber) ?? ""
        }
    }

    private var labelColor: Color {
        switch visualStyle {
        case .onboarding:
            return Color.textPrimaryOnboarding
        case .flat:
            return Color.textPrimary
        }
    }

    private var prefixColor: Color {
        switch visualStyle {
        case .onboarding:
            return Color.textSecondaryOnboarding
        case .flat:
            return Color.textTertiary
        }
    }

    private var backgroundColor: Color {
        switch visualStyle {
        case .onboarding:
            return Color.authInputBackground
        case .flat:
            return Color.surfaceSecondary
        }
    }

    private var shadowColor: Color {
        switch visualStyle {
        case .onboarding:
            return effectiveFocus ? Color.pulpePrimary.opacity(0.2) : Color.black.opacity(0.05)
        case .flat:
            return .clear
        }
    }

    private var shadowRadius: CGFloat {
        switch visualStyle {
        case .onboarding:
            return effectiveFocus ? 12 : 4
        case .flat:
            return 0
        }
    }

    private var shadowYOffset: CGFloat {
        switch visualStyle {
        case .onboarding:
            return 4
        case .flat:
            return 0
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
            .sensitiveAmount()
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
            hint: "0.00",
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
