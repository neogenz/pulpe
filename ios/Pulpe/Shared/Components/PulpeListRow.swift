import SwiftUI

/// The V2 ledger row (`row`): optional leading slot (usually a `PointCircle`), a 16pt
/// semibold title with one 13pt `ink2` fact under it, a trailing amount or slot, and a chevron
/// when the row opens something. At least 60pt tall. No category icon, and a pointed row keeps
/// full opacity: pointing is shown by the leading check alone.
struct PulpeListRow<Leading: View, Trailing: View>: View {
    let title: String
    var subtitle: String?
    var showsChevron = true
    /// An overrun reads in the ocre; every other fact in the secondary ink.
    var subtitleTint: Color = .textSecondary
    let leading: Leading
    let trailing: Trailing

    init(
        title: String,
        subtitle: String? = nil,
        subtitleTint: Color = .textSecondary,
        showsChevron: Bool = true,
        @ViewBuilder leading: () -> Leading,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.title = title
        self.subtitle = subtitle
        self.subtitleTint = subtitleTint
        self.showsChevron = showsChevron
        self.leading = leading()
        self.trailing = trailing()
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            leading

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                Text(title)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                if let subtitle {
                    Text(subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(subtitleTint)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            trailing
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)

            if showsChevron {
                RowChevron()
            }
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .contentShape(Rectangle())
    }
}

extension PulpeListRow where Leading == EmptyView {
    init(
        title: String,
        subtitle: String? = nil,
        subtitleTint: Color = .textSecondary,
        showsChevron: Bool = true,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.init(
            title: title,
            subtitle: subtitle,
            subtitleTint: subtitleTint,
            showsChevron: showsChevron,
            leading: { EmptyView() },
            trailing: trailing
        )
    }
}

#Preview {
    VStack(spacing: DesignTokens.Spacing.none) {
        PulpeListRow(
            title: "Transport",
            subtitle: "Reste 88.00",
            leading: { PointCircle(isPointed: false, isSyncing: false) {} },
            trailing: { Text("120.00") }
        )
        Divider().overlay(Color.outlineVariant)
        PulpeListRow(
            title: "Loyer",
            subtitle: "Mensuel · pointé le 31 oct.",
            leading: { PointCircle(isPointed: true, isSyncing: false) {} },
            trailing: { Text("1'850.00") }
        )
    }
    .padding(.horizontal, DesignTokens.Spacing.lg)
    .pulpeSurfaceCard()
    .padding()
    .background(Color.appBackground)
}
