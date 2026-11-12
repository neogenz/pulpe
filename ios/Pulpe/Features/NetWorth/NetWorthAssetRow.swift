import SwiftUI

struct NetWorthAssetActions {
    let edit: () -> Void
    let toggleArchive: () -> Void
    let delete: () -> Void
}

/// One asset: name, value in its own currency (and, for a foreign one, the base-currency
/// counterpart computed by the API), then its last-update line and its warnings.
struct NetWorthAssetRow: View {
    let asset: Asset
    let baseCurrency: SupportedCurrency
    /// Shown before « mis à jour » where the card is not the element's Type (« Découverts »).
    var categoryName: String?
    var actions: NetWorthAssetActions?

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
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                Text(asset.name)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
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
            Text(updatedLine)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            if !asset.badges.isEmpty {
                HStack(spacing: DesignTokens.Spacing.xs) {
                    ForEach(asset.badges, id: \.self) { badge in
                        PulpeChip(label: label(of: badge), style: .semantic(.financialOverBudget))
                    }
                }
                .padding(.top, DesignTokens.Spacing.xs)
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
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

    private var updatedLine: String {
        let when = asset.ageLabel()
        let line = categoryName.map { AppLocale.string("\($0) · mis à jour \(when)") }
            ?? AppLocale.string("Mis à jour \(when)")
        // A followed account says where its balance comes from, in the same breath.
        return asset.inPulpe ? AppLocale.string("\(line) · au rapprochement") : line
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
