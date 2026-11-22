import SwiftUI

/// « Ajouter un compte »: a new free row, a sum I owe (a free row on « Je dois »), or an item of
/// « Mon patrimoine » whose balance follows what I type. Picking one adds the row and closes.
struct ReconcileAddAccountSheet: View {
    let flow: ReconcileAccountsFlow
    /// Items a saving prévision of the month feeds: never offered.
    let fedAssetIds: Set<String>
    /// What the step focuses once this sheet is gone.
    let onAdded: (ReconcileAccountField) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(AssetStore.self) private var assetStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    Text("Seulement les comptes de tes dépenses. Pas l'épargne.")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                    FormCard {
                        ActionRow(
                            title: AppLocale.string("Nouveau compte"),
                            subtitle: AppLocale.string("Juste pour comparer")
                        ) { addFree(isOwed: false) }
                        FormRowDivider()
                        ActionRow(
                            title: AppLocale.string("Une somme que je dois"),
                            subtitle: AppLocale.string("PayPal, Klarna, facture programmée")
                        ) { addFree(isOwed: true) }
                    }
                    if flow.linksToNetWorth { netWorthBlock }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.sheetBackground)
            .localizedNavigationTitle("Ajouter un compte")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { SheetCloseButton() } }
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }

    // MARK: - Mon patrimoine

    @ViewBuilder private var netWorthBlock: some View {
        let addable = flow.addableAssets(excluding: fedAssetIds)
        // Types in the order of Mon patrimoine; a Type with nothing to add is left out.
        let groups = assetStore.categories.compactMap { category -> (name: String, assets: [Asset])? in
            let assets = addable.filter { $0.categoryId == category.id }
            return assets.isEmpty ? nil : (category.name, assets)
        }
        if !groups.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text("Depuis Mon patrimoine")
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .accessibilityAddTraits(.isHeader)
                    Text("Mis à jour avec ce que tu tapes")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                ForEach(groups, id: \.name) { group in
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text(verbatim: group.name)
                            .font(PulpeTypography.captionRegular)
                            .foregroundStyle(Color.textSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.lg)
                        FormCard {
                            ForEach(Array(group.assets.enumerated()), id: \.element.id) { index, asset in
                                if index > 0 { FormRowDivider() }
                                ActionRow(
                                    title: asset.name,
                                    subtitle: AppLocale.string(asset.direction == .owe ? "Je dois" : "J'ai")
                                ) { add(asset) }
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func addFree(isOwed: Bool) {
        onAdded(.label(flow.addFreeAccount(isOwed: isOwed)))
        dismiss()
    }

    private func add(_ asset: Asset) {
        onAdded(.amount(flow.addAsset(asset)))
        dismiss()
    }
}
