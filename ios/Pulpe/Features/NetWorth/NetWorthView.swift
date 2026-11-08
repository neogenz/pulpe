import SwiftUI

/// « Mon patrimoine » (PUL-366): net worth, then what I have by category, what I owe and the
/// archives. Read-only; every figure comes from `GET /v1/assets`.
struct NetWorthView: View {
    @Environment(AssetStore.self) private var store
    @Environment(ToastManager.self) private var toastManager
    @State private var showsArchived = false
    @State private var form: FormTarget?
    @State private var pendingDelete: Asset?
    @State private var valueTarget: Asset?
    @State private var showsCategories = false

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
        .sheet(item: $valueTarget) { AssetValueSheet(asset: $0) }
        .sheet(isPresented: $showsCategories) { AssetCategoriesSheet() }
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
        .accessibilityIdentifier("netWorthRoot")
    }

    private var emptyScreen: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            PulpeEmptyState(
                systemImage: "building.columns",
                title: AppLocale.string("Ton patrimoine commence ici"),
                // swiftlint:disable:next line_length
                message: AppLocale.string("Ajoute un compte, un livret ou une dette pour voir ta fortune nette du jour."),
                actionTitle: AppLocale.string("Ajouter un avoir"),
                action: { form = .create }
            )
            // Categories outlive their assets: manageable on the empty screen too.
            categoriesRow
                .padding([.horizontal, .bottom], DesignTokens.Spacing.lg)
        }
    }

    private var categoriesRow: some View {
        ContextLinkRow(
            icon: "folder",
            iconTint: .pulpePrimary,
            title: AppLocale.string("Gérer les catégories")
        ) { showsCategories = true }
            .accessibilityIdentifier("netWorthCategories")
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
                ForEach(sections.categories) { category in
                    section(
                        title: category.name,
                        total: category.total,
                        currency: sections.baseCurrency,
                        assets: category.assets,
                        sections: sections
                    )
                }
                if !sections.debts.isEmpty {
                    section(
                        title: AppLocale.string("Ce que je dois"),
                        total: sections.debtsTotal,
                        currency: sections.baseCurrency,
                        assets: sections.debts,
                        sections: sections,
                        showsCategory: true
                    )
                }
                if !sections.archived.isEmpty { archived(sections) }
                categoriesRow
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .refreshable { await store.forceRefresh() }
    }

    private func section(
        title: String,
        total: Decimal,
        currency: SupportedCurrency,
        assets: [Asset],
        sections: NetWorthSections,
        showsCategory: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: title, trailingAmount: total.asCurrency(currency))
            rows(assets, sections: sections, showsCategory: showsCategory)
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
                    updateValue: { valueTarget = asset },
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
