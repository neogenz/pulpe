import SwiftUI

/// What the « Compte » of a movement may be, given the element it is also linked to (PUL-378).
enum AccountLink {
    /// The default account as a start value: still active, and never the element the movement
    /// already feeds, repays or draws from (CA45).
    @MainActor
    static func start(defaultId: String?, link: String?, store: AssetStore) -> String? {
        let active = store.activeAssetId(defaultId)
        return active == link ? nil : active
    }

    /// The same element cannot be both (CA25): the API refuses it too.
    static func conflicts(account: String?, link: String?) -> Bool {
        account != nil && account == link
    }

    /// A link that lands on the prefilled account puts the account back on « Aucun » (CA45); one
    /// the user chose on purpose stays, and is refused with a message instead.
    static func afterLinkChange(account: String?, link: String?, defaultId: String?) -> String? {
        conflicts(account: account, link: link) && account == defaultId ? nil : account
    }

    /// What a creation sends. Nothing until the field has shown, so with the flag off the body
    /// is the one from before the feature (CA2). Then always stated (`null` = « Aucun »), so the
    /// server's default never overrides a choice.
    static func onCreate(account: String?, didPrefill: Bool) -> String?? {
        didPrefill ? .some(account) : nil
    }

    /// A free movement states its account as above; an allocated one follows its prévision.
    static func onCreate(lineId: String?, account: String?, didPrefill: Bool) -> String?? {
        lineId == nil ? onCreate(account: account, didPrefill: didPrefill) : nil
    }

    /// What a movement PATCH sends: only a free movement whose account moved, so an untouched
    /// edit keeps it (CA26).
    static func onUpdate(lineId: String?, initial: String?, account: String?) -> String?? {
        lineId == nil ? assetLinkChange(initial: initial, current: account) : nil
    }

    /// Keeps the action and names the element chosen twice (CA25).
    static func conflictMessage(name: String) -> String {
        AppLocale.string("Choisis un autre compte : « \(name) » est déjà l'élément lié.")
    }
}

/// Form field that says which net-worth element a movement moves once pointed (PUL-378):
/// « Aucun », then what I have, then what I owe. Renders nothing when the `net_worth` flag is
/// off or no element is active, so callers place it unconditionally. `selection` is the element
/// id (`nil` = « Aucun »).
struct AccountPickerField: View {
    @Binding var selection: String?
    var title = AppLocale.string("Compte")
    /// The « Versée sur » / « Dette remboursée » / « Tiré de » element, and its title.
    var link: String?
    var linkTitle: String?
    /// Starts on the default account once the elements are loaded (creation only): `nil` never
    /// prefills. The sheet owns the flag, because the field leaves the screen and comes back
    /// (a prévision picked then dropped) and must not prefill over « Aucun » a second time.
    var didPrefill: Binding<Bool>?
    /// Alone in its own card, or a bare row for a `List`.
    var style: FormRowStyle = .standalone

    @Environment(AssetStore.self) private var store
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @Environment(UserSettingsStore.self) private var settings
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var selectedAsset: Asset? {
        guard let selection else { return nil }
        return store.netWorth?.assets.first { $0.id == selection }
    }

    /// Absent with the flag off, or with no element to choose from (CA2, CA28).
    static func isShown(flagEnabled: Bool, store: AssetStore) -> Bool {
        flagEnabled && !store.activeAssets.isEmpty
    }

    private var isShown: Bool {
        Self.isShown(flagEnabled: featureFlags.isNetWorthEnabled, store: store)
    }

    var body: some View {
        if featureFlags.isNetWorthEnabled {
            // A container that always renders: an empty Group never runs its `.task`.
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                if isShown {
                    if style == .standalone {
                        FormCard { menu }
                    } else {
                        menu
                    }
                    if linkTitle != nil, AccountLink.conflicts(account: selection, link: link),
                       let name = selectedAsset?.name {
                        Text(AccountLink.conflictMessage(name: name))
                            .font(PulpeTypography.footnote)
                            .foregroundStyle(Color.destructivePrimary)
                    }
                }
            }
            .task {
                await store.loadIfNeeded()
                guard let didPrefill, !didPrefill.wrappedValue else { return }
                didPrefill.wrappedValue = true
                if selection == nil {
                    selection = AccountLink.start(defaultId: settings.defaultAccountId, link: link, store: store)
                }
            }
        }
    }

    private var menu: some View {
        let none = AppLocale.string("Aucun")
        return Menu {
            savingsGoalPickerButton(title: none, isSelected: selection == nil) { selection = nil }
            section(AppLocale.string("Ce que j'ai"), direction: .own)
            section(AppLocale.string("Ce que je dois"), direction: .owe)
        } label: {
            label(value: selectedAsset?.name ?? none, isPlaceholder: selectedAsset == nil)
        }
        .accessibilityLabel(title)
        .accessibilityValue(selectedAsset?.name ?? none)
    }

    /// In a card, the shared goal-picker row (stacked at accessibility sizes); in a `List`, the
    /// plain row of the other settings.
    @ViewBuilder
    private func label(value: String, isPlaceholder: Bool) -> some View {
        if style == .standalone, !dynamicTypeSize.isAccessibilitySize {
            savingsGoalMenuLabel(style: .row, title: title, value: value, isPlaceholder: isPlaceholder)
        } else if style == .standalone {
            savingsGoalFieldSurface(style: .row) { listRow(value: value) }
        } else {
            listRow(value: value)
        }
    }

    private func listRow(value: String) -> some View {
        HStack {
            // At accessibility sizes the account goes under the title: beside it, it was cut.
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    rowTitle
                    Text(value).foregroundStyle(Color.onSurfaceVariant)
                }
                // A Menu label centers wrapped lines by default.
                .multilineTextAlignment(.leading)
                Spacer(minLength: DesignTokens.Spacing.sm)
            } else {
                rowTitle
                Spacer()
                Text(value).foregroundStyle(Color.onSurfaceVariant).lineLimit(1)
            }
            Image(systemName: "chevron.right")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
        }
        .contentShape(Rectangle())
    }

    private var rowTitle: some View {
        Text(title).font(PulpeTypography.listRowTitle).foregroundStyle(Color.textPrimary)
    }

    @ViewBuilder
    private func section(_ name: String, direction: AssetDirection) -> some View {
        let assets = store.accountChoices(direction: direction, keeping: selection)
        if !assets.isEmpty {
            Section(name) {
                ForEach(assets) { asset in
                    savingsGoalPickerButton(title: asset.name, isSelected: asset.id == selection) {
                        selection = asset.id
                    }
                }
            }
        }
    }
}
