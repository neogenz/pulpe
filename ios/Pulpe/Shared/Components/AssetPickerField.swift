import SwiftUI

/// Form field that links a prévision to a net-worth asset (PUL-366): an Épargne feeds
/// an asset I own, a Dépense repays a debt. Renders nothing when the `net_worth` flag
/// is off or the kind has no direction (Revenu), so callers place it unconditionally.
/// `selection` is the asset id (`nil` = « Aucun »).
struct AssetPickerField: View {
    @Binding var selection: String?
    let kind: TransactionKind
    var style: FormRowStyle = .row
    /// An income drawn FROM an own asset: the field shows for a Revenu, with its own wording.
    var drawn = false

    @Environment(AssetStore.self) private var store
    @Environment(FeatureFlagsStore.self) private var featureFlags

    /// Whether the field is visible: lets a caller keep an otherwise empty card out of the layout.
    static func isShown(kind: TransactionKind, flagEnabled: Bool) -> Bool {
        flagEnabled && kind.assetDirection != nil
    }

    private var direction: AssetDirection? { drawn ? .own : kind.assetDirection }

    private var selectedAsset: Asset? {
        guard let selection else { return nil }
        return store.netWorth?.assets.first { $0.id == selection }
    }

    private func title(_ direction: AssetDirection) -> String {
        if drawn { return AppLocale.string("Tiré de") }
        return AppLocale.string(direction == .own ? "Versée sur" : "Dette remboursée")
    }

    var body: some View {
        if featureFlags.isNetWorthEnabled, let direction {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                menu(direction: direction)
                if drawn, let selectedAsset {
                    Text(AppLocale.string(
                        "Une fois pointé, je te propose de baisser la valeur de \(selectedAsset.name)."
                    ))
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .padding(.bottom, DesignTokens.Spacing.lg)
                } else if direction == .owe, let selectedAsset {
                    Text(AppLocale.string(
                        "Une fois pointée, je te propose de baisser ce qu'il reste dû sur \(selectedAsset.name)."
                    ))
                        .font(PulpeTypography.footnote)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .padding(.bottom, DesignTokens.Spacing.lg)
                }
            }
            .task { await store.loadIfNeeded() }
        }
    }

    private func menu(direction: AssetDirection) -> some View {
        let none = AppLocale.string("Aucun")
        return Menu {
            savingsGoalPickerButton(title: none, isSelected: selection == nil) { selection = nil }
            Divider()
            ForEach(store.activeAssets(direction: direction)) { asset in
                savingsGoalPickerButton(title: asset.name, isSelected: asset.id == selection) {
                    selection = asset.id
                }
            }
        } label: {
            savingsGoalMenuLabel(
                style: style,
                title: title(direction),
                value: selectedAsset?.name ?? none,
                isPlaceholder: selectedAsset == nil
            )
        }
        .accessibilityLabel(title(direction))
        .accessibilityValue(selectedAsset?.name ?? none)
    }
}
