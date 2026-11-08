import SwiftUI

struct NetWorthAssetActions {
    let edit: () -> Void
    let toggleArchive: () -> Void
    let delete: () -> Void
}

/// One asset: name, badges, last-update line, value in its own currency and, for a foreign
/// one, the base-currency counterpart computed by the API.
struct NetWorthAssetRow: View {
    let asset: Asset
    let baseCurrency: SupportedCurrency
    /// Shown before « mis à jour » on a debt, which is not under its category.
    var categoryName: String?
    var actions: NetWorthAssetActions?

    var body: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.xs) {
            content
            if let actions { menu(actions) }
        }
    }

    private var content: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(asset.name)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                Text(updatedLine)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                if !asset.badges.isEmpty {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        ForEach(asset.badges, id: \.self) { badge in
                            PulpeChip(label: label(of: badge), style: style(of: badge))
                        }
                    }
                }
            }
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
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .combine)
    }

    private func menu(_ actions: NetWorthAssetActions) -> some View {
        Menu {
            Button(AppLocale.string("Modifier"), systemImage: "pencil", action: actions.edit)
            Button(
                asset.archivedAt == nil ? AppLocale.string("Archiver") : AppLocale.string("Désarchiver"),
                systemImage: asset.archivedAt == nil ? "archivebox" : "tray.and.arrow.up",
                action: actions.toggleArchive
            )
            Button(AppLocale.string("Supprimer"), systemImage: "trash", role: .destructive, action: actions.delete)
        } label: {
            Image(systemName: "ellipsis")
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textSecondary)
                .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
        }
        .accessibilityLabel(AppLocale.string("Actions pour \(asset.name)"))
        .accessibilityIdentifier("netWorthRowMenu")
    }

    private var updatedLine: String {
        let when = asset.ageLabel()
        if let categoryName {
            return AppLocale.string("\(categoryName) · mis à jour \(when)")
        }
        return AppLocale.string("Mis à jour \(when)")
    }

    private func label(of badge: NetWorthBadge) -> String {
        switch badge {
        case .inPulpe: AppLocale.string("Dans Pulpe")
        case .overdraft: AppLocale.string("Découvert")
        case .excluded: AppLocale.string("Hors total")
        }
    }

    private func style(of badge: NetWorthBadge) -> PulpeChip<EmptyView>.Style {
        switch badge {
        case .inPulpe: .semantic(.pulpePrimary)
        case .overdraft, .excluded: .semantic(.financialOverBudget)
        }
    }
}
