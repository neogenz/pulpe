import SwiftUI

@MainActor
struct TemplateBudgetProjectionStores {
    let budgetList: BudgetListStore
    let dashboard: DashboardStore
    let currentMonth: CurrentMonthStore
    let savingsGoal: SavingsGoalStore

    func invalidate() {
        budgetList.invalidateCache()
        dashboard.invalidateCache()
        currentMonth.invalidateCache()
        BudgetDetailCache.shared.invalidateAll()
        savingsGoal.invalidateFromBudgetMutation()
    }
}

struct TemplateDetailsView: View {
    let templateId: String
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(TagStore.self) var tagStore
    @Environment(AppState.self) private var appState
    @Environment(ToastManager.self) private var toastManager
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) var openURL
    @State var viewModel: TemplateDetailsViewModel
    @State var selectedLineForEdit: TemplateLine?
    @State var showDeleteConfirmation = false

    init(templateId: String) {
        self.templateId = templateId
        self._viewModel = State(initialValue: TemplateDetailsViewModel(templateId: templateId))
    }

    var body: some View {
        Group {
            switch viewModel.content {
            case .loaded(let template):
                content(template: template)
                    .transition(.opacity)
            case .failed(let error):
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
                .transition(.opacity)
            case .loading:
                TemplateDetailsSkeletonView()
                    .transition(.opacity)
            }
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.content)
        .navigationTitle(viewModel.template?.name ?? AppLocale.string("Modèle"))
        .navigationBarTitleDisplayMode(.inline)
        // The page states the model's name in its own header.
        .toolbar(removing: .title)
        .pulpeBackground()
        .task(id: savingsGoalStore.templateDataVersion) {
            await viewModel.loadDetails()
        }
        .task {
            let projectionStores = TemplateBudgetProjectionStores(
                budgetList: budgetListStore,
                dashboard: dashboardStore,
                currentMonth: currentMonthStore,
                savingsGoal: savingsGoalStore
            )
            viewModel.onBudgetDataMutation = {
                projectionStores.invalidate()
            }
            await savingsGoalStore.loadIfNeeded()
        }
        .task(id: referencedTagIds) {
            await tagStore.loadIfNeeded(for: referencedTagIds)
        }
        .sheet(item: $selectedLineForEdit) { line in
            EditTemplateLineSheet(
                templateLine: line,
                templateName: viewModel.template?.name ?? "",
                templateLines: viewModel.lines,
                userCurrency: userSettingsStore.currency
            ) { updatedLine, impact in
                Task {
                    await viewModel.updateTemplateLine(updatedLine)
                    appState.templatesVersion += 1
                }
                viewModel.announceBudgetDataMutation(for: impact)
            }
        }
        .alert(
            AppLocale.string("Supprimer \(viewModel.template?.name ?? "") ?"),
            isPresented: $showDeleteConfirmation
        ) {
            Button("Supprimer", role: .destructive) { Task { await deleteTemplate() } }
            Button("Annuler", role: .cancel) {}
        } message: {
            Text(TemplatePresentation.deleteMessage(lineCount: viewModel.lines.count))
        }
    }

    private func deleteTemplate() async {
        do {
            try await viewModel.deleteTemplate()
            appState.templatesVersion += 1
            toastManager.show(AppLocale.string("Modèle supprimé"))
            dismiss()
        } catch {
            toastManager.show(DomainErrorLocalizer.localize(error), type: .error)
        }
    }

    private var referencedTagIds: Set<String> {
        Set(viewModel.lines.flatMap { $0.tagIds ?? [] })
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class TemplateDetailsViewModel {
    let templateId: String

    private(set) var template: BudgetTemplate?
    private(set) var lines: [TemplateLine] = []
    /// How many budgets were built from the model; `nil` until the usage is known.
    private(set) var usedBudgetCount: Int?
    private(set) var error: Error?
    private var hasLoadedOnce = false

    private let templateService: any TemplateServicing
    @ObservationIgnored var onBudgetDataMutation: (@MainActor () -> Void)?

    init(templateId: String, templateService: any TemplateServicing = TemplateService.shared) {
        self.templateId = templateId
        self.templateService = templateService
    }

    /// What the page renders; the body `switch`es on it so no state renders nothing.
    enum Content {
        case loading
        case failed(Error)
        case loaded(BudgetTemplate)
    }

    var content: Content {
        if let template { return .loaded(template) }
        if let error { return .failed(error) }
        return .loading
    }

    var totals: BudgetFormulas.TemplateTotals {
        BudgetFormulas.calculateTemplateTotals(lines: lines)
    }

    var incomeLines: [TemplateLine] {
        lines.filter { $0.kind == .income }
    }

    var expenseLines: [TemplateLine] {
        lines.filter { $0.kind == .expense }
    }

    var savingLines: [TemplateLine] {
        lines.filter { $0.kind == .saving }
    }

    func loadIfNeeded() async {
        guard !hasLoadedOnce else { return }
        await loadDetails()
    }

    func loadDetails() async {
        let showsSkeleton = template == nil
        error = nil
        let loadStart = ContinuousClock.now

        do {
            async let templateTask = templateService.getTemplate(id: templateId)
            async let linesTask = templateService.getTemplateLines(templateId: templateId)
            async let usageTask = try? templateService.checkTemplateUsage(id: templateId)

            let (fetchedTemplate, fetchedLines) = try await (templateTask, linesTask)
            let usage = await usageTask

            if showsSkeleton {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
            }

            template = fetchedTemplate
            lines = fetchedLines
            usedBudgetCount = usage?.budgetCount
            hasLoadedOnce = true
        } catch is CancellationError {
            // Task was cancelled, don't update error state
        } catch {
            self.error = error
        }
    }

    func updateTemplateLine(_ line: TemplateLine) async {
        // Optimistic update
        if let index = lines.firstIndex(where: { $0.id == line.id }) {
            lines[index] = line
        }

        // Reload to sync with server
        await loadDetails()
    }

    /// Deleting is offered only while no budget uses the model.
    var canDelete: Bool { usedBudgetCount == 0 }

    func deleteTemplate() async throws {
        try await templateService.deleteTemplate(id: templateId)
    }

    func announceBudgetDataMutation(for impact: EditTemplateLineSaveImpact) {
        guard impact == .budgetsChanged else { return }
        onBudgetDataMutation?()
    }
}

// MARK: - Skeleton

/// Same regions as the loaded page: the header, the hero card, a section and its card.
private struct TemplateDetailsSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.longTextWidth,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.extraLongTextWidth,
                        height: DesignTokens.Skeleton.captionHeight
                    )
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.shortTextWidth,
                        height: DesignTokens.Skeleton.captionHeight
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.longTextWidth,
                        height: DesignTokens.Skeleton.bodyHeight
                    )
                    SkeletonShape(
                        width: DesignTokens.Skeleton.extraLongTextWidth,
                        height: DesignTokens.Skeleton.captionHeight
                    )
                }
                .padding(DesignTokens.Spacing.xl)
                .frame(maxWidth: .infinity, alignment: .leading)
                .pulpeSurfaceCard()
                .padding(.horizontal, DesignTokens.Spacing.lg)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.shortTextWidth,
                        height: DesignTokens.Skeleton.lineHeight
                    )
                    VStack(spacing: DesignTokens.Spacing.none) {
                        ForEach(0..<3, id: \.self) { index in
                            if index > 0 { Divider().overlay(Color.outlineVariant) }
                            row
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .pulpeSurfaceCard()
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.vertical, DesignTokens.Spacing.sm)
        }
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du modèle")
    }

    /// Same slots as `TemplateLineRow`: name over its subtitle, the amount, the chevron.
    private var row: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            SkeletonShape(
                width: DesignTokens.Skeleton.compactTextWidth,
                height: DesignTokens.Skeleton.lineHeight
            )
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

#Preview {
    NavigationStack {
        TemplateDetailsView(templateId: "test")
    }
    .environment(UserSettingsStore())
    .environment(BudgetListStore())
    .environment(DashboardStore())
    .environment(CurrentMonthStore())
    .environment(SavingsGoalStore())
    .environment(TagStore())
    .environment(AppState())
    .environment(ToastManager())
}

// The body switches on `content` and the transition animates on it: one rule.
extension TemplateDetailsViewModel.Content: Equatable {
    static func == (lhs: Self, rhs: Self) -> Bool {
        switch (lhs, rhs) {
        case (.loading, .loading): true
        case let (.failed(lhs), .failed(rhs)): lhs.localizedDescription == rhs.localizedDescription
        case let (.loaded(lhs), .loaded(rhs)): lhs == rhs
        default: false
        }
    }
}
