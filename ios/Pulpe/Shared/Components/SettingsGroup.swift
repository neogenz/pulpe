import SwiftUI

/// A group of settings lines (V2 `fgroup`): a sentence-case header, one white card holding the
/// rows (the caller places the `FormRowDivider`s) and an optional footer.
struct SettingsGroup<Content: View>: View {
    var header: String?
    var footer: String?
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if let header {
                SettingsSectionHeader(text: header)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            FormCard(content: content)
            if let footer {
                Text(footer)
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// The sentence-case header of a settings group, also used as a `List` section header.
struct SettingsSectionHeader: View {
    /// Already localized (`AppLocale.string`), like `SettingsGroup.header`.
    let text: String

    var body: some View {
        Text(text)
            .font(PulpeTypography.bannerText.weight(.semibold))
            .foregroundStyle(Color.textSecondary)
            .textCase(nil)
            .accessibilityAddTraits(.isHeader)
    }
}

#Preview {
    SettingsGroup(header: "Réglages", footer: "Une phrase de contexte.") {
        SettingsRow(systemImage: "gearshape", title: "Préférences", subtitle: "Devise, langue")
        FormRowDivider()
        SettingsRow(systemImage: "tag", title: "Mes tags")
    }
    .padding()
    .background(Color.appBackground)
}
