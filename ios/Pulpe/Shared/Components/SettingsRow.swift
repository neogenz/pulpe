import SwiftUI

/// One line of a settings group (V2 `frow` + `sico`): a 32pt `sunk` icon tile with an `ink2`
/// glyph, a title, an optional value in `ink2` and a chevron when the line opens something.
/// Not interactive by itself: wrap it in a `Button` or `NavigationLink`.
struct SettingsRow: View {
    let systemImage: String
    let title: String
    var subtitle: String?
    var value: String?
    var showsChevron = true
    /// ↗ instead of the chevron: the line leaves the app.
    var isExternal = false

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: systemImage)
                .font(.system(size: DesignTokens.Control.settingsGlyph, weight: .regular))
                .foregroundStyle(Color.textSecondary)
                .frame(width: DesignTokens.Control.settingsTile, height: DesignTokens.Control.settingsTile)
                .background(Color.sunk, in: .rect(cornerRadius: DesignTokens.CornerRadius.settingsTile))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(title)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                if let subtitle {
                    Text(subtitle)
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let value {
                Text(value)
                    .font(PulpeTypography.rowTitleRegular)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)
            }
            if isExternal {
                Image(systemName: "arrow.up.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            } else if showsChevron {
                RowChevron()
            }
        }
        .frame(minHeight: subtitle == nil ? DesignTokens.ListRow.formRowHeight : DesignTokens.ListRow.minHeight)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

#Preview {
    FormCard(title: "Compte") {
        SettingsRow(systemImage: "person", title: "Profil", value: "Maxime")
        FormRowDivider()
        SettingsRow(systemImage: "bell", title: "Rappels")
        FormRowDivider()
        SettingsRow(systemImage: "info.circle", title: "Version", value: "1.0", showsChevron: false)
    }
    .padding()
    .background(Color.appBackground)
}
