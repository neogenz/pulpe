import SwiftUI

/// Eyebrow + content block of an onboarding step ("Logement", "Suggestions", "Mes prévisions").
struct OnboardingSectionHeader<Content: View>: View {
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(title)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textSecondary)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }
}

/// Label on the left, amount box on the right (V2 `onb-amt`): one fixed charge or saving of a step.
struct OnboardingAmountRow: View {
    let label: String
    var systemImage: String?
    @Binding var value: Decimal?
    let currency: SupportedCurrency
    var hint: String?

    @State private var text = ""
    @FocusState private var isFocused: Bool

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            if let systemImage {
                RowIcon(systemName: systemImage, tint: Color.textSecondary)
            }
            Text(label)
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            TextField("0.00", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .font(PulpeTypography.rowAmount)
                .focused($isFocused)
                .padding(.horizontal, DesignTokens.Spacing.md)
                .frame(
                    minWidth: DesignTokens.Control.inlineAmountFieldMinWidth,
                    maxWidth: DesignTokens.Control.inlineAmountFieldMinWidth
                )
                .frame(height: DesignTokens.Entry.amountBoxHeight)
                .background(Color.appBackground, in: .rect(cornerRadius: DesignTokens.Entry.amountBoxRadius))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.Entry.amountBoxRadius)
                        .strokeBorder(
                            isFocused ? Color.pulpePrimary : Color.outline,
                            lineWidth: isFocused ? DesignTokens.Control.inputFocusBorder : DesignTokens.BorderWidth.thin
                        )
                }
                .accessibilityLabel(label)
        }
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .onAppear { text = displayed(value) }
        .onChange(of: text) { _, newValue in value = newValue.parsedAsAmount }
        .onChange(of: value) { _, newValue in
            // Echo only a change that did not come from this field (a restored draft), not mid-typing.
            guard !isFocused else { return }
            text = displayed(newValue)
        }
        // Typed "39" settles as "39.00" once the field lets go, like every other amount.
        .onChange(of: isFocused) { _, focused in
            if !focused { text = displayed(value) }
        }
    }
}

private extension OnboardingAmountRow {
    func displayed(_ amount: Decimal?) -> String {
        amount.map { $0.asAmount(for: currency) } ?? ""
    }
}

/// "+ Ajouter une charge": a leading green link, no filled disc.
struct OnboardingAddLink: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: "plus")
                Text(title)
            }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
            .contentShape(Rectangle())
        }
        .plainPressedButtonStyle()
    }
}
