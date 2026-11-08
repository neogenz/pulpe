import SwiftUI

/// « Mon patrimoine » (PUL-366): net worth, then what I have by category, what I owe and the
/// archives. Read-only; every figure comes from `GET /v1/assets`.
struct NetWorthView: View {
    @Environment(AssetStore.self) private var store
    @State private var showsArchived = false

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
                PulpeEmptyState(
                    systemImage: "building.columns",
                    title: AppLocale.string("Ton patrimoine commence ici"),
                    // swiftlint:disable:next line_length
                    message: AppLocale.string("Ajoute un compte, un livret ou une dette pour voir ta fortune nette du jour.")
                )
            case .loaded(let sections):
                loaded(sections)
            }
        }
        .navigationTitle(AppLocale.string("Mon patrimoine"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .pulpeBackground()
        .task { await store.loadIfNeeded() }
        .accessibilityIdentifier("netWorthRoot")
    }

    private func loaded(_ sections: NetWorthSections) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(title: AppLocale.string("Mon patrimoine"))
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                NetWorthHero(sections: sections)
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
                NetWorthAssetRow(
                    asset: asset,
                    baseCurrency: sections.baseCurrency,
                    categoryName: showsCategory ? sections.categoryName(of: asset) : nil
                )
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
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
}
