import SwiftUI

struct TemplateListView: View {
    /// Set when a model opens beside the list (the open iPhone Duo) rather than on top of it.
    var selectedTemplateId: Binding<String?>?

    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel = TemplateListViewModel()
    @State private var showCreateTemplate = false

    private var isBesideDetail: Bool { selectedTemplateId != nil }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.templates.isEmpty {
                TemplateListSkeletonView()
                    .transition(.opacity)
            } else if let error = viewModel.error, viewModel.templates.isEmpty {
                ErrorView(error: error) {
                    await viewModel.loadTemplates()
                }
                .transition(.opacity)
            } else if viewModel.templates.isEmpty {
                emptyState
                    .transition(.opacity)
            } else {
                templateList
                    .transition(.opacity)
            }
        }
        .trackScreen("TemplateList")
        .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.isLoading)
        .localizedNavigationTitle("Modèles")
        .navigationBarTitleDisplayMode(.inline)
        // The page states its name in its own header.
        .toolbar(removing: .title)
        .pulpeBackground()
        .sheet(isPresented: $showCreateTemplate) {
            CreateTemplateView { template in
                viewModel.addTemplate(template)
                open(template.id)
            }
        }
        .refreshable {
            await viewModel.loadTemplates()
        }
        .task {
            await viewModel.loadIfNeeded()
        }
        // A model edited or deleted on its page changes what the list shows.
        .onChange(of: appState.templatesVersion) {
            Task { await viewModel.loadTemplates() }
        }
        // Beside the list a page is always open: the first model until one is picked, and
        // again once the one shown is deleted.
        .onChange(of: viewModel.templates.map(\.id), initial: true) { _, ids in
            guard let selectedTemplateId, !ids.contains(selectedTemplateId.wrappedValue ?? "") else { return }
            selectedTemplateId.wrappedValue = ids.first
        }
    }

    private func open(_ templateId: String) {
        if let selectedTemplateId {
            // A page pushed beside the list belongs to the model being left.
            appState.templatePath = NavigationPath()
            selectedTemplateId.wrappedValue = templateId
        } else {
            appState.templatePath.append(TemplateDestination.details(templateId: templateId))
        }
    }

    private var header: some View {
        PageHeader(
            title: AppLocale.string("Modèles"),
            subtitle: AppLocale.string("Le point de départ de chaque nouveau mois")
        )
        .padding(.top, DesignTokens.Spacing.sm)
    }

    // MARK: - Empty

    private var emptyState: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                header
                EmptyStateCard(
                    systemImage: "doc.text",
                    title: AppLocale.string("Pas encore de modèle"),
                    message: AppLocale.string("Crée-en un pour préparer tes prochains budgets plus vite."),
                    actionTitle: AppLocale.string("Créer un modèle")
                ) { showCreateTemplate = true }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                Text("""
                    Un modèle liste tes revenus, tes dépenses et ton épargne habituels. \
                    Chaque nouveau mois part de lui, tu ajustes ensuite.
                    """)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.xl)
            }
        }
        .pulpeRootBottomInset()
    }

    // MARK: - List

    private var templateList: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                if !isBesideDetail {
                    header
                }
                rows
                Text(TemplatePresentation.listFooter(
                    count: viewModel.templates.count,
                    limit: AppConfiguration.maxTemplates
                ))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.xl)

                Button { showCreateTemplate = true } label: {
                    Label("Nouveau modèle", systemImage: "plus").frame(maxWidth: .infinity)
                }
                .secondaryButtonStyle()
                .disabled(viewModel.isLimitReached)
                .accessibilityIdentifier("templateAddButton")
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
    }

    private var rows: some View {
        let rows = VStack(spacing: DesignTokens.Spacing.none) {
            ForEach(viewModel.templates) { template in
                if template.id != viewModel.templates.first?.id {
                    Divider().overlay(Color.outlineVariant)
                }
                TemplateRow(
                    template: template,
                    summary: viewModel.summaries[template.id],
                    currency: userSettingsStore.currency,
                    isShownBesideList: selectedTemplateId.map { $0.wrappedValue == template.id }
                ) {
                    open(template.id)
                }
            }
        }
        // Beside the page, the rows sit bare on the canvas and the one shown lifts.
        return Group {
            if isBesideDetail {
                rows.padding(.horizontal, DesignTokens.Spacing.lg)
            } else {
                rows.padding(.horizontal, DesignTokens.Spacing.lg).pulpeSurfaceCard()
                    .padding(.horizontal, DesignTokens.Spacing.lg)
            }
        }
    }
}

// MARK: - Skeleton

/// Same regions as `templateList`: the header, a card of three rows, so nothing shifts when
/// the models land.
private struct TemplateListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.mediumTextWidth,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.extraLongTextWidth,
                        height: DesignTokens.Skeleton.captionHeight
                    )
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)

                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(0..<3, id: \.self) { index in
                        if index > 0 { Divider().overlay(Color.outlineVariant) }
                        row
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .pulpeSurfaceCard()
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
        }
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement des modèles")
    }

    /// Same slots as `TemplateRow`: name over subtitle, the balance over its caption, the chevron.
    private var row: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.longTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.numericWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            SkeletonShape(
                width: DesignTokens.Spacing.xs,
                height: DesignTokens.Spacing.md,
                cornerRadius: DesignTokens.CornerRadius.xs
            )
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
    }
}

// MARK: - Template Row

/// One model of the list: name over « Par défaut · 11 lignes », the disponible it starts a
/// month with on the right. No icon; the balance reads in ink.
struct TemplateRow: View {
    let template: BudgetTemplate
    let summary: TemplateListViewModel.Summary?
    let currency: SupportedCurrency
    /// Whether the model is the one shown beside the list; nil when the row pushes it instead.
    var isShownBesideList: Bool?
    let onTap: () -> Void

    var body: some View {
        if let isShownBesideList {
            rowContent
                .selectsBesidePane(isSelected: isShownBesideList, action: onTap)
                .accessibilityIdentifier("templateRow-\(template.id)")
        } else {
            Button(action: onTap) { rowContent }
                .plainPressedButtonStyle()
                .contentShape(.rect)
                .accessibilityIdentifier("templateRow-\(template.id)")
        }
    }

    private var rowContent: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                Text(template.name)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                if let subtitle = template.subtitle(lineCount: summary?.lineCount) {
                    Text(subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let available = summary?.available {
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(verbatim: available.asAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(available < 0 ? Color.financialOverBudget : Color.textPrimary)
                        .lineLimit(1)
                        .sensitiveAmount()
                    Text("disponible")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            // A chevron promises a push; beside the page, the row only selects.
            if isShownBesideList == nil {
                RowChevron()
            }
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class TemplateListViewModel {
    /// What a row shows besides the model itself.
    struct Summary: Equatable {
        let lineCount: Int
        let available: Decimal
    }

    private(set) var templates: [BudgetTemplate] = []
    private(set) var summaries: [String: Summary] = [:]
    private(set) var isLoading = false
    private(set) var error: Error?

    private let templateService = TemplateService.shared
    private var lastLoadTime: Date?

    var isLimitReached: Bool {
        templates.count >= AppConfiguration.maxTemplates
    }

    func loadIfNeeded() async {
        guard templates.isEmpty || !isCacheValid else { return }
        await loadTemplates()
    }

    private var isCacheValid: Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity
    }

    func loadTemplates() async {
        let showsSkeleton = templates.isEmpty
        isLoading = true
        error = nil
        let loadStart = ContinuousClock.now
        defer { isLoading = false }

        do {
            let fetched = try await templateService.getAllTemplates()
            let fetchedSummaries = await loadSummaries(for: fetched)

            if showsSkeleton {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
            }

            templates = fetched
            summaries = fetchedSummaries
            lastLoadTime = Date()
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            self.error = error
        }
    }

    /// One read of the lines per model (at most `maxTemplates`); a model whose lines fail to
    /// load simply shows no figure.
    private func loadSummaries(for templates: [BudgetTemplate]) async -> [String: Summary] {
        await withTaskGroup(of: (String, Summary?).self) { group in
            for template in templates {
                group.addTask {
                    let lines = try? await self.templateService.getTemplateLines(templateId: template.id)
                    return (template.id, lines.map {
                        Summary(lineCount: $0.count, available: TemplatePresentation.Split(lines: $0).available)
                    })
                }
            }
            var result: [String: Summary] = [:]
            for await (id, summary) in group {
                if let summary { result[id] = summary }
            }
            return result
        }
    }

    func addTemplate(_ template: BudgetTemplate) {
        templates.append(template)
    }
}

#Preview {
    NavigationStack {
        TemplateListView()
    }
    .environment(AppState())
    .environment(UserSettingsStore())
}
