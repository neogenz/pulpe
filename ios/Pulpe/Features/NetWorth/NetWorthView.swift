import SwiftUI

/// « Mon patrimoine » (PUL-366): net worth, then what I have and what I owe, each by Type, and
/// the archives. Read-only; every figure comes from `GET /v1/assets`.
struct NetWorthView: View {
    @Environment(AssetStore.self) private var store
    @Environment(ToastManager.self) private var toastManager
    @State private var showsArchived = false
    @State private var form: FormTarget?
    @State private var pendingDelete: Asset?
    @State private var renameTarget: NetWorthSections.Group?

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
        .confirmationDialog(
            pendingDelete.map { AppLocale.string("Supprimer \($0.name) ?") } ?? "",
            isPresented: Binding(get: { pendingDelete != nil }, set: { if !$0 { pendingDelete = nil } }),
            titleVisibility: .visible,
            presenting: pendingDelete
        ) { asset in
            Button(AppLocale.string("Supprimer"), role: .destructive) {
                run { try await store.delete(id: asset.id) }
            }
        } message: { _ in
            // swiftlint:disable:next line_length
            Text("Tout son historique de valeurs est supprimé aussi. Archive-le plutôt pour le sortir des totaux en gardant l'historique.")
        }
        .task { await store.forceRefresh() }
        .trackScreen(AnalyticsScreen.netWorth)
        .accessibilityIdentifier("netWorthRoot")
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
        VStack(spacing: DesignTokens.Spacing.none) {
            groupHeader(group, currency: sections.baseCurrency)
            ForEach(group.assets, id: \.id) { asset in
                Divider().overlay(Color.outlineVariant)
                assetRow(asset, sections: sections, showsCategory: !group.isType)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
    }

    private func groupHeader(_ group: NetWorthSections.Group, currency: SupportedCurrency) -> some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text(group.name)
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textPrimary)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(group.total.asCurrency(currency))
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()
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
        VStack(spacing: DesignTokens.Spacing.none) {
            NetWorthAssetRow(
                asset: asset,
                baseCurrency: sections.baseCurrency,
                categoryName: showsCategory ? sections.categoryName(of: asset) : nil,
                actions: NetWorthAssetActions(
                    edit: { form = .edit(asset) },
                    toggleArchive: {
                        run { try await store.setArchived(id: asset.id, asset.archivedAt == nil) }
                    },
                    delete: { pendingDelete = asset }
                )
            )
            if let suggestion = asset.visibleSuggestion {
                NetWorthSuggestionRow(
                    asset: asset,
                    suggestion: suggestion,
                    apply: {
                        run {
                            let item = AssetSnapshotItem(assetId: asset.id, value: suggestion.proposedValue)
                            try await store.recordSnapshots(AssetSnapshotsCreate(items: [item]))
                        }
                    },
                    dismiss: { run { try await store.dismissSuggestion(id: asset.id) } }
                )
            }
        }
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
