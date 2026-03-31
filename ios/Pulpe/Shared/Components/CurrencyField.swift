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
    let currency: String
    let visualStyle: VisualStyle

    @Environment(\.colorScheme) private var colorScheme
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
        currency: String = "CHF",
        visualStyle: VisualStyle = .onboarding,
        externalFocus: FocusState<Bool>.Binding? = nil
    ) {
        self._value = value
        self.hint = hint
        self.label = label
        self.currency = currency
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
                Text(currency)
                    .foregroundStyle(prefixColor)
                    .font(PulpeTypography.bodyLarge)

                TextField(hint, text: $textValue)
                    .keyboardType(.decimalPad)
                    .foregroundStyle(Color.authInputText)
                    .focused(externalFocus ?? $internalFocus)
                    .accessibilityLabel(label ?? "Montant en \(currency)")
                    .onChange(of: textValue) { _, newValue in
                        updateValue(from: newValue)
                    }
                    .onChange(of: value) { _, newValue in
                        if hasInitialized {
                            updateText(from: newValue)
                        }
                    }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .frame(height: DesignTokens.FrameHeight.button)
            .background { fieldBackground }
            .contentShape(.interaction, Rectangle())
            .onTapGesture { (externalFocus ?? $internalFocus).wrappedValue = true }
            .ifLet(shadowStyle) { view, style in view.shadow(style) }
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

    private var borderColor: Color {
        effectiveFocus ? Color.pulpePrimary.opacity(0.45) : Color.authInputBorder
    }

    private var borderWidth: CGFloat {
        effectiveFocus ? DesignTokens.BorderWidth.thick : DesignTokens.BorderWidth.hairline
    }

    @ViewBuilder
    private var fieldBackground: some View {
        switch visualStyle {
        case .onboarding:
            Capsule(style: .continuous)
                .fill(backgroundColor)
                .overlay {
                    Capsule(style: .continuous)
                        .strokeBorder(borderColor, lineWidth: borderWidth)
                }
        case .flat:
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md, style: .continuous)
                .fill(backgroundColor)
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md, style: .continuous)
                        .strokeBorder(borderColor, lineWidth: borderWidth)
                }
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
            return Color.textSecondaryOnboarding.opacity(0.7)
        case .flat:
            return Color.textTertiary
        }
    }

    private var backgroundColor: Color {
        switch visualStyle {
        case .onboarding:
            return Color.authInputBackground
        case .flat:
            return Color.surfaceContainer
        }
    }

    private var shadowStyle: ShadowStyle? {
        switch visualStyle {
        case .onboarding:
            return colorScheme == .dark
                ? ShadowStyle(color: .black.opacity(0.01), radius: 2, y: 1)
                : DesignTokens.Shadow.input
        case .flat:
            return nil
        }
    }
}

/// Compact currency display for read-only values
struct CurrencyText: View {
    let amount: Decimal
    let showSign: Bool
    let currency: String
    let style: TextStyle

    enum TextStyle {
        case title
        case body
        case caption
    }

    init(_ amount: Decimal, showSign: Bool = false, currency: String = "CHF", style: TextStyle = .body) {
        self.amount = amount
        self.showSign = showSign
        self.currency = currency
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
        let style = Decimal.FormatStyle.Currency(code: currency)
            .locale(Formatters.locale(for: currency))
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
