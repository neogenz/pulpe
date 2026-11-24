import SwiftUI

/// An element's detail (PUL-379), pushed from « Mon patrimoine »: its name, Type and value, the
/// last entry, then its whole history, newest first, a page at a time. Nothing is computed
/// here: values, effects and order come from `GET /v1/assets/:id/history`.
struct AssetDetailView: View {
    @Environment(AssetStore.self) private var store
    @State private var model: AssetHistoryModel
    @State private var isEditing = false

    init(assetId: String, service: any AssetServicing = AssetService.shared) {
        _model = State(initialValue: AssetHistoryModel(assetId: assetId, service: service))
    }

    var body: some View {
        Group {
            switch model.content {
            case .loading:
                LoadingView()
            case .notFound:
                ContentUnavailableView(
                    AppLocale.string("Cet élément n'est plus disponible"),
                    systemImage: "building.columns"
                )
            case .failed(let error):
                ErrorView(error: error) { await model.load() }
            case .loaded(let asset):
                loaded(asset)
            }
        }
        .navigationTitle(model.asset?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .pulpeBackground()
        // Runs on every appearance: a movement unchecked in the budget is gone on return (CA8).
        .task { await model.load() }
        .sheet(isPresented: $isEditing, onDismiss: editDismissed) {
            if let asset = model.asset {
                AssetFormSheet(asset: asset, currency: store.totals?.baseCurrency ?? .chf)
            }
        }
        .trackScreen(AnalyticsScreen.netWorthAssetDetail)
        .accessibilityIdentifier("assetDetailRoot")
    }

    private func loaded(_ asset: Asset) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(title: asset.name, subtitle: store.categories.first { $0.id == asset.categoryId }?.name)
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    summary(asset)
                    history(asset)
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .refreshable { await model.load() }
    }

    private func summary(_ asset: Asset) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text(asset.latestValue.netWorthSigned(asset.currency, showsPlus: false))
                .font(PulpeTypography.amountHero)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .sensitiveAmount()
            Text(asset.lastEntryCaption())
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .sensitiveAmount()
            Button(AppLocale.string("Modifier")) { isEditing = true }
                .secondaryButtonStyle()
                .accessibilityIdentifier("assetDetailEdit")
        }
    }

    private func history(_ asset: Asset) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Historique"))
            if let entryDate = model.nothingCheckedSince {
                Text(AppLocale.string("Tu n'as rien pointé depuis ta saisie du \(dayLabel(entryDate))."))
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
            }
            LazyVStack(spacing: DesignTokens.Spacing.none) {
                ForEach(model.entries) { entry in
                    if entry.id != model.entries.first?.id { Divider().overlay(Color.outlineVariant) }
                    AssetHistoryRow(line: AssetHistoryLine(entry, currency: asset.currency))
                        .onAppear {
                            if entry.id == model.entries.last?.id, !model.loadMoreFailed {
                                Task { await model.loadMore() }
                            }
                        }
                }
                pageFooter
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
            .accessibilityIdentifier("assetDetailHistory")
        }
    }

    @ViewBuilder
    private var pageFooter: some View {
        if model.isLoadingMore {
            ProgressView()
                .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        } else if model.loadMoreFailed {
            Button(AppLocale.string("Impossible de charger la suite, réessaie")) {
                Task { await model.loadMore() }
            }
            .textLinkButtonStyle()
            .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
        }
    }

    /// A saved entry moves the value and the history (CA9).
    private func editDismissed() {
        Task { await model.load() }
    }

    private func dayLabel(_ date: Date) -> String {
        AssetHistoryLine.dayLabel(date, now: Date(), calendar: .current, language: AppLocale.current)
    }
}

/// The history of one element: `load` reads the first page and replaces everything, `loadMore`
/// appends the next one. A page read for an older `load` is dropped.
@Observable @MainActor
final class AssetHistoryModel {
    enum Content {
        case loading
        case notFound
        case failed(APIError)
        case loaded(Asset)
    }

    private(set) var asset: Asset?
    private(set) var entries: [AssetHistoryEntry] = []
    private(set) var nextCursor: String?
    private(set) var error: APIError?
    private(set) var isLoading = false
    private(set) var isLoadingMore = false
    private(set) var loadMoreFailed = false

    private let assetId: String
    private let service: any AssetServicing
    private var generation = 0

    init(assetId: String, service: any AssetServicing) {
        self.assetId = assetId
        self.service = service
    }

    /// A reload keeps the page on screen; only a first read shows the loading or failed state.
    var content: Content {
        if case .assetNotFound? = error { return .notFound }
        if let asset { return .loaded(asset) }
        return error.map { .failed($0) } ?? .loading
    }

    /// The last entry's date when nothing was checked since (CA10): the newest line is that entry.
    var nothingCheckedSince: Date? {
        guard let first = entries.first, first.isSnapshot else { return nil }
        return first.at
    }

    func load() async {
        generation += 1
        let current = generation
        isLoading = true
        isLoadingMore = false
        loadMoreFailed = false
        defer { if current == generation { isLoading = false } }
        do {
            let page = try await service.getHistory(id: assetId, cursor: nil)
            guard current == generation else { return }
            asset = page.asset
            entries = page.entries
            nextCursor = page.nextCursor
            error = nil
        } catch where error.isCancellationOrURLCancellation {
            // Left the screen: keep what is shown.
        } catch {
            guard current == generation else { return }
            self.error = error as? APIError ?? .networkError(error)
        }
    }

    func loadMore() async {
        guard let cursor = nextCursor, !isLoading, !isLoadingMore else { return }
        let current = generation
        isLoadingMore = true
        loadMoreFailed = false
        defer { if current == generation { isLoadingMore = false } }
        do {
            let page = try await service.getHistory(id: assetId, cursor: cursor)
            guard current == generation else { return }
            entries += page.entries
            nextCursor = page.nextCursor
        } catch where error.isCancellationOrURLCancellation {
            // Left the screen: the last row asks again when it reappears.
        } catch {
            if current == generation { loadMoreFailed = true }
        }
    }
}
