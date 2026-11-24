import SwiftUI

struct NetWorthAssetActions {
    let edit: () -> Void
    let toggleArchive: () -> Void
    let delete: () -> Void
}

/// One asset: name, value in its own currency (and, for a foreign one, the base-currency
/// counterpart computed by the API), then what moved since the last entry (else its age) and
/// its warnings.
struct NetWorthAssetRow: View {
    let asset: Asset
    let baseCurrency: SupportedCurrency
    /// Leads the meta line where the card is not the element's Type (« Découverts »).
    var categoryName: String?
    var actions: NetWorthAssetActions?
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.xs) {
            if let actions, asset.archivedAt == nil {
                // The row and its menu are siblings: tapping the row edits, the menu holds the rest.
                Button(action: actions.edit) { content }
                    .contentShape(Rectangle())
                    .plainPressedButtonStyle()
                    .accessibilityHint(AppLocale.string("Modifier"))
                    .accessibilityIdentifier("netWorthRowEdit")
            } else {
                content
            }
            if let actions { menu(actions) }
        }
    }

    private var content: some View {
        // The caption runs under the whole row: beside the amount, it would wrap.
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            // At accessibility sizes the amount goes under the name: beside it, it broke mid-number.
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    name
                    amounts(alignment: .leading)
                }
            } else {
                HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                    name
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    amounts(alignment: .trailing)
                }
            }
            Text(asset.metaLine(categoryName: categoryName))
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount(asset.movedSinceEntry != nil)
            if !asset.badges.isEmpty {
                HStack(spacing: DesignTokens.Spacing.xs) {
                    ForEach(asset.badges, id: \.self) { badge in
                        PulpeChip(label: label(of: badge), style: .semantic(.financialOverBudget))
                    }
                }
                .padding(.top, DesignTokens.Spacing.xs)
            }
        }
        // Stacked, nothing else fills the row: every row starts at the same edge.
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
    }

    private var name: some View {
        Text(asset.name)
            .font(PulpeTypography.rowTitle)
            .foregroundStyle(Color.textPrimary)
    }

    private func amounts(alignment: HorizontalAlignment) -> some View {
        VStack(alignment: alignment, spacing: DesignTokens.Spacing.xxs) {
            Text(asset.latestValue.asCurrency(asset.currency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
            if asset.showsConversion(in: baseCurrency), let converted = asset.convertedValue {
                Text("≈ \(converted.asCurrency(baseCurrency))")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
            }
        }
        .sensitiveAmount()
    }

    private func menu(_ actions: NetWorthAssetActions) -> some View {
        Menu {
            if asset.archivedAt == nil {
                Button(AppLocale.string("Modifier"), systemImage: "pencil", action: actions.edit)
            }
            Button(
                asset.archivedAt == nil ? AppLocale.string("Archiver") : AppLocale.string("Désarchiver"),
                systemImage: asset.archivedAt == nil ? "archivebox" : "tray.and.arrow.up",
                action: actions.toggleArchive
            )
            Button(AppLocale.string("Supprimer"), systemImage: "trash", role: .destructive, action: actions.delete)
        } label: {
            NetWorthMenuLabel()
        }
        .accessibilityLabel(AppLocale.string("Actions pour \(asset.name)"))
        .accessibilityIdentifier("netWorthRowMenu")
    }

    private func label(of badge: NetWorthBadge) -> String {
        switch badge {
        case .overdraft: AppLocale.string("Découvert")
        case .excluded: AppLocale.string("Hors total")
        }
    }
}

/// The ⋮ of a row or of a Type header.
struct NetWorthMenuLabel: View {
    var body: some View {
        Image(systemName: "ellipsis")
            .font(PulpeTypography.rowTitle)
            .foregroundStyle(Color.textSecondary)
            .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
    }
}
