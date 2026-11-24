import SwiftUI

/// « Mon patrimoine » (PUL-366): net worth, then what I have and what I owe, each by Type, and
/// the archives. Totals come from `GET /v1/assets`; only a debt Type's total is summed here.
struct NetWorthView: View {
    @Environment(AssetStore.self) private var store
    @Environment(AppState.self) private var appState
    @Environment(ToastManager.self) private var toastManager
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(FeatureFlagsStore.self) private var featureFlags
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var showsArchived = false
    @AppStorage(NetWorthSections.collapsedStorageKey) private var collapsedGroupIds = ""
    @State private var form: FormTarget?
    @State private var pendingDelete: Asset?
    @State private var renameTarget: NetWorthSections.Group?
    @AppStorage(NetWorthIntroGate.storageKey) private var hasSeenIntro = false
    @State private var introSource: NetWorthIntroSource?
    @State private var opensFormAfterIntro = false

    private enum FormTarget: Identifiable {
        case create
        case edit(Asset)

        var id: String {
            switch self {
            case .create: "create"
            case .edit(let asset): asset.id
            }
        }
    }

    private enum Content {
        case loading
        case failed(APIError)
        case empty
        case loaded(NetWorthSections)
    }

    private var content: Content {
        if let netWorth = store.netWorth {
            let sections = NetWorthSections(netWorth)
            return sections.isEmpty ? .empty : .loaded(sections)
        }
        if let error = store.error { return .failed(error) }
        return .loading
    }

    var body: some View {
        Group {
            switch content {
            case .loading:
                LoadingView()
            case .failed(let error):
                ErrorView(error: error) { await store.forceRefresh() }
            case .empty:
                emptyScreen
            case .loaded(let sections):
                loaded(sections)
            }
        }
        .navigationTitle(AppLocale.string("Mon patrimoine"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .toolbar {
            if store.netWorth != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(AppLocale.string("Comprendre mon patrimoine"), systemImage: "questionmark.circle") {
                        introSource = .help
                    }
                    .accessibilityIdentifier("netWorthHelp")
                }
            }
            if case .loaded = content {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(AppLocale.string("Ajouter"), systemImage: "plus") { form = .create }
                        .accessibilityIdentifier("netWorthAdd")
                }
            }
        }
        .pulpeBackground()
        .sheet(item: $form) { target in
            switch target {
            case .create: AssetFormSheet(asset: nil, currency: baseCurrency)
            case .edit(let asset): AssetFormSheet(asset: asset, currency: baseCurrency)
            }
        }
        .sheet(item: $renameTarget) { RenameAssetTypeSheet(type: $0) }
        .sheet(item: $introSource, onDismiss: introDismissed) { source in
            NetWorthIntroSheet(
                source: source,
                isEmpty: store.netWorth.map { NetWorthSections($0).isEmpty } ?? true,
                currency: baseCurrency
            ) { outcome in
                opensFormAfterIntro = outcome == .completed(.add)
                introSource = nil
            }
        }
        .onChange(of: store.netWorth != nil, initial: true) { _, isLoaded in
            if introSource == nil, NetWorthIntroGate.shouldPresentIntro(hasSeen: hasSeenIntro, isLoaded: isLoaded) {
                introSource = .auto
            }
        }
        .confirmationDialog(
            pendingDelete.map { AppLocale.string("Supprimer \($0.name) ?") } ?? "",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { asset in
            Button(AppLocale.string("Supprimer"), role: .destructive) {
                run {
                    try await store.delete(id: asset.id)
                    await userSettingsStore.forceRefresh()
                }
            }
        } message: { _ in
            // swiftlint:disable:next line_length
            Text("Tout son historique de valeurs est supprimé aussi. Archive-le plutôt pour le sortir des totaux en gardant l'historique.")
        }
        .task { await store.forceRefresh() }
        .trackScreen(AnalyticsScreen.netWorth)
        .accessibilityIdentifier("netWorthRoot")
    }

    /// The creation form waits for the explainer to be fully gone: two sheets cannot animate at once.
    private func introDismissed() {
        hasSeenIntro = true
        if opensFormAfterIntro {
            opensFormAfterIntro = false
            form = .create
        }
    }

    private var emptyScreen: some View {
        PulpeEmptyState(
            systemImage: "building.columns",
            title: AppLocale.string("Ton patrimoine commence ici"),
            message: AppLocale.string("Ajoute un compte, un livret ou une dette pour voir ta fortune nette du jour."),
            actionTitle: AppLocale.string("Ajouter un avoir"),
            action: { form = .create }
        )
    }

    private func loaded(_ sections: NetWorthSections) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(title: AppLocale.string("Mon patrimoine"))
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                NetWorthHero(sections: sections)
                if let netWorth = store.netWorth, let graph = NetWorthSankey.build(netWorth) {
                    NetWorthBreakdownCard(graph: graph, totals: netWorth.totals)
                }
                side(AppLocale.string("Ce que j'ai"), groups: sections.categories, sections: sections)
                side(AppLocale.string("Ce que je dois"), groups: sections.debtGroups, sections: sections)
                if !sections.archived.isEmpty { archived(sections) }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .refreshable { await store.forceRefresh() }
    }

    /// Both sides are built the same way: a heading, then one card per Type.
    @ViewBuilder
    private func side(_ title: String, groups: [NetWorthSections.Group], sections: NetWorthSections) -> some View {
        if !groups.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                SectionHeader(title: title)
                ForEach(groups) { group in
                    card(group, sections: sections)
                }
            }
        }
    }

    private func card(_ group: NetWorthSections.Group, sections: NetWorthSections) -> some View {
        let isCollapsed = NetWorthSections.isCollapsed(group.id, in: collapsedGroupIds)
        return VStack(spacing: DesignTokens.Spacing.none) {
            groupHeader(group, currency: sections.baseCurrency, isCollapsed: isCollapsed)
            if !isCollapsed {
                ForEach(group.assets, id: \.id) { asset in
                    Divider().overlay(Color.outlineVariant)
                    assetRow(asset, sections: sections, showsCategory: !group.isType)
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
    }

    /// The chevron leads and the whole row folds the card; the menu keeps its own target.
    private func groupHeader(
        _ group: NetWorthSections.Group, currency: SupportedCurrency, isCollapsed: Bool
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Button {
                withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                    collapsedGroupIds = NetWorthSections.toggled(group.id, in: collapsedGroupIds)
                }
            } label: {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(Color.textSecondary)
                        .rotationEffect(.degrees(isCollapsed ? 0 : 90))
                        .accessibilityHidden(true)
                    groupTitle(group, currency: currency)
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
            }
            .plainPressedButtonStyle()
            .accessibilityAddTraits(.isHeader)
            .accessibilityHint(isCollapsed ? "Appuie pour développer" : "Appuie pour réduire")
            .accessibilityIdentifier("netWorthGroupToggle")
            if group.isType {
                Menu {
                    Button(AppLocale.string("Renommer le type"), systemImage: "pencil") { renameTarget = group }
                } label: {
                    NetWorthMenuLabel()
                }
                .accessibilityLabel(AppLocale.string("Actions pour \(group.name)"))
                .accessibilityIdentifier("netWorthTypeMenu")
            } else {
                // Keeps the total aligned with the cards that carry a menu.
                Color.clear.frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
            }
        }
    }

    /// At accessibility sizes the total goes under the name: beside it, both broke mid-word.
    @ViewBuilder
    private func groupTitle(_ group: NetWorthSections.Group, currency: SupportedCurrency) -> some View {
        let name = Text(group.name)
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.textPrimary)
        let total = Text(group.total.asCurrency(currency))
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.textSecondary)
            .monospacedDigit()
            .sensitiveAmount()
        if dynamicTypeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                name
                total.lineLimit(1).minimumScaleFactor(DesignTokens.TextScale.floor)
            }
            Spacer(minLength: DesignTokens.Spacing.none)
        } else {
            name
            Spacer(minLength: DesignTokens.Spacing.sm)
            total
        }
    }

    private func rows(_ assets: [Asset], sections: NetWorthSections, showsCategory: Bool) -> some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            ForEach(Array(assets.enumerated()), id: \.element.id) { index, asset in
                if index > 0 { Divider().overlay(Color.outlineVariant) }
                assetRow(asset, sections: sections, showsCategory: showsCategory)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
    }

    private func assetRow(_ asset: Asset, sections: NetWorthSections, showsCategory: Bool) -> some View {
        NetWorthAssetRow(
            asset: asset,
            baseCurrency: sections.baseCurrency,
            categoryName: showsCategory ? sections.categoryName(of: asset) : nil,
            actions: NetWorthAssetActions(
                open: { appState.pushOnActiveStack(NetWorthDestination.asset(id: asset.id)) },
                edit: { form = .edit(asset) },
                toggleArchive: {
                    run {
                        try await store.setArchived(id: asset.id, asset.archivedAt == nil)
                        await userSettingsStore.forceRefresh()
                    }
                },
                delete: { pendingDelete = asset },
                toggleDefault: offersDefault(asset) ? { toggleDefault(asset) } : nil
            ),
            isDefault: NetWorthDefaultAccount.isDefault(asset, defaultId: userSettingsStore.defaultAccountId)
        )
    }

    private func archived(_ sections: NetWorthSections) -> some View {
        CollapsibleSection(
            title: showsArchived
                ? AppLocale.string("Masquer les archives")
                : AppLocale.string("Voir les archives (\(sections.archived.count))"),
            isExpanded: $showsArchived
        ) {
            rows(sections.archived, sections: sections, showsCategory: false)
        }
    }

    private func offersDefault(_ asset: Asset) -> Bool {
        NetWorthDefaultAccount.offersMenuEntry(for: asset, flagEnabled: featureFlags.isNetWorthEnabled)
    }

    private func toggleDefault(_ asset: Asset) {
        Task {
            await userSettingsStore.setDefaultAccount(
                NetWorthDefaultAccount.settingAfterToggle(of: asset, current: userSettingsStore.defaultAccountId)
            )
            if let error = userSettingsStore.error {
                toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            }
        }
    }

    private var baseCurrency: SupportedCurrency { store.totals?.baseCurrency ?? .chf }

    /// A failed write is told by a toast; the store has already refetched.
    private func run(_ operation: @escaping () async throws -> Void) {
        Task {
            do { try await operation() } catch {
                toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
            }
        }
    }
}
