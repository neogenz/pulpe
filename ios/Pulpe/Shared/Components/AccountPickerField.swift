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

    /// What a creation sends. A free movement always states its account (`null` = « Aucun »), so
    /// the server's default never overrides a choice; an allocated one follows its prévision.
    static func onCreate(lineId: String?, account: String?) -> String?? {
        lineId == nil ? .some(account) : nil
    }

    /// What a movement PATCH sends: only a free movement whose account moved, so an untouched
    /// edit keeps it (CA26).
    static func onUpdate(lineId: String?, initial: String?, account: String?) -> String?? {
        lineId == nil ? assetLinkChange(initial: initial, current: account) : nil
    }

    static func conflictMessage(linkTitle: String) -> String {
        AppLocale.string("« Compte » et « \(linkTitle) » doivent être deux éléments différents.")
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
    /// Starts on the default account once the elements are loaded (creation only).
    var prefillsDefault = false
    /// Alone in its own card, or a bare row for a `List`.
    var style: FormRowStyle = .standalone

    @Environment(AssetStore.self) private var store
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @Environment(UserSettingsStore.self) private var settings
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var didPrefill = false

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
                    if let linkTitle, AccountLink.conflicts(account: selection, link: link) {
                        Text(AccountLink.conflictMessage(linkTitle: linkTitle))
                            .font(PulpeTypography.footnote)
                            .foregroundStyle(Color.destructivePrimary)
                    }
                }
            }
            .task {
                await store.loadIfNeeded()
                guard prefillsDefault, !didPrefill else { return }
                didPrefill = true
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

    /// In a card, the shared goal-picker row; in a `List`, the plain row of the other settings.
    @ViewBuilder
    private func label(value: String, isPlaceholder: Bool) -> some View {
        if style == .standalone {
            savingsGoalMenuLabel(style: .row, title: title, value: value, isPlaceholder: isPlaceholder)
        } else {
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
    }

    private var rowTitle: some View {
        Text(title).font(PulpeTypography.listRowTitle).foregroundStyle(Color.textPrimary)
    }

    @ViewBuilder
    private func section(_ name: String, direction: AssetDirection) -> some View {
        let assets = store.activeAssets(direction: direction)
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
