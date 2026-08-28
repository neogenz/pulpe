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
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(TagStore.self) private var tagStore
    @State private var viewModel: TemplateDetailsViewModel
    @State private var selectedLineForEdit: TemplateLine?

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
        .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.isLoading)
        .navigationTitle(viewModel.template?.name ?? AppLocale.string("Modèle"))
        .navigationBarTitleDisplayMode(.inline)
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
                userCurrency: userSettingsStore.currency
            ) { updatedLine, impact in
                Task { await viewModel.updateTemplateLine(updatedLine) }
                viewModel.announceBudgetDataMutation(for: impact)
            }
        }
    }

    private var referencedTagIds: Set<String> {
        Set(viewModel.lines.flatMap { $0.tagIds ?? [] })
    }

    private func content(template: BudgetTemplate) -> some View {
        List {
            // Template info
            Section {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    if let description = template.description, !description.isEmpty {
                        Text(description)
                            .font(PulpeTypography.body)
                            .foregroundStyle(Color.textSecondary)
                    }

                    if template.isDefaultTemplate {
                        PulpeChip(
                            icon: "checkmark.circle.fill",
                            label: AppLocale.string("Par défaut"),
                            style: .semantic(.financialSavings)
                        )
                    }
                }
                .padding(.vertical, DesignTokens.Spacing.xs)
            }

            totalsSection

            // Lines by kind
            if !viewModel.incomeLines.isEmpty {
                templateLineSection(title: AppLocale.string("Revenus"), lines: viewModel.incomeLines, kind: .income)
            }

            if !viewModel.expenseLines.isEmpty {
                templateLineSection(
                    title: AppLocale.string("Dépenses"),
                    lines: viewModel.expenseLines,
                    kind: .expense
                )
            }

            if !viewModel.savingLines.isEmpty {
                templateLineSection(title: AppLocale.string("Épargne"), lines: viewModel.savingLines, kind: .saving)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .refreshable {
            await viewModel.loadDetails()
        }
    }

    private var totalsSection: some View {
        Section {
            HStack(spacing: DesignTokens.Spacing.md) {
                Circle()
                    .fill(Color.financialIncome.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                    .overlay {
                        Image(systemName: "arrow.down.circle")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.financialIncome)
                    }
                Text("Revenus")
                    .font(PulpeTypography.subheadline)
                Spacer()
                Text(viewModel.totals.totalIncome.asSignedCompactCurrency(userSettingsStore.currency, for: .income))
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.financialIncome)
                    .sensitiveAmount()
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)

            HStack(spacing: DesignTokens.Spacing.md) {
                Circle()
                    .fill(Color.financialExpense.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                    .overlay {
                        Image(systemName: "arrow.up.circle")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.financialExpense)
                    }
                Text("Dépenses")
                    .font(PulpeTypography.subheadline)
                Spacer()
                Text(viewModel.totals.totalExpenses.asSignedCompactCurrency(userSettingsStore.currency, for: .expense))
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.financialExpense)
                    .sensitiveAmount()
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)

            HStack(spacing: DesignTokens.Spacing.md) {
                Circle()
                    .fill(
                        (viewModel.totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget)
                            .opacity(DesignTokens.Opacity.badgeBackground)
                    )
                    .frame(width: DesignTokens.IconSize.compact, height: DesignTokens.IconSize.compact)
                    .overlay {
                        Image(systemName: "banknote")
                            .font(PulpeTypography.caption)
                            .foregroundStyle(
                                viewModel.totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget
                            )
                    }
                Text("Solde")
                    .font(PulpeTypography.subheadline)
                    .fontWeight(.semibold)
                Spacer()
                Text(viewModel.totals.balance.asArithmeticSignedCompactCurrency(userSettingsStore.currency))
                    .font(PulpeTypography.listRowSubtitle)
                    .fontWeight(.semibold)
                    .foregroundStyle(
                        viewModel.totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget
                    )
                    .sensitiveAmount()
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)
        } header: {
            Text("Récapitulatif")
        }
    }

    private func templateLineSection(title: String, lines: [TemplateLine], kind: TransactionKind) -> some View {
        Section {
            ForEach(lines) { line in
                TemplateLineRow(line: line, tagNamesById: tagStore.namesById) {
                    selectedLineForEdit = line
                }
            }
        } header: {
            HStack {
                Text(title)
                Text(verbatim: "· \(lines.count)")
                Spacer()
                let total = lines.reduce(Decimal.zero) { $0 + $1.amount }
                Text(total.asSignedCompactCurrency(userSettingsStore.currency, for: kind))
                    .font(PulpeTypography.caption)
                    .sensitiveAmount()
            }
        }
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class TemplateDetailsViewModel {
    let templateId: String

    private(set) var template: BudgetTemplate?
    private(set) var lines: [TemplateLine] = []
    private(set) var isLoading = false
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
        isLoading = true
        error = nil
        let loadStart = ContinuousClock.now
        defer { isLoading = false }

        do {
            async let templateTask = templateService.getTemplate(id: templateId)
            async let linesTask = templateService.getTemplateLines(templateId: templateId)

            let (fetchedTemplate, fetchedLines) = try await (templateTask, linesTask)

            if showsSkeleton {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
            }

            template = fetchedTemplate
            lines = fetchedLines
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

    func announceBudgetDataMutation(for impact: EditTemplateLineSaveImpact) {
        guard impact == .budgetsChanged else { return }
        onBudgetDataMutation?()
    }
}

// MARK: - Skeleton

private struct TemplateDetailsSkeletonView: View {
    var body: some View {
        List {
            // Info section
            Section {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.longTextWidth,
                        height: DesignTokens.Skeleton.bodyHeight
                    )
                    // `PulpeChip` is a capsule, not a rounded tag.
                    SkeletonShape(
                        width: DesignTokens.Skeleton.shortTextWidth,
                        height: DesignTokens.Skeleton.chipHeight,
                        cornerRadius: .infinity
                    )
                }
                .padding(.vertical, DesignTokens.Spacing.xs)
            }

            // Totals section
            Section {
                ForEach(0..<3, id: \.self) { _ in
                    HStack(spacing: DesignTokens.Spacing.md) {
                        SkeletonShape(
                            width: DesignTokens.IconSize.compact,
                            height: DesignTokens.IconSize.compact,
                            cornerRadius: DesignTokens.IconSize.compact / 2
                        )
                        SkeletonShape(
                            width: DesignTokens.Skeleton.shortTextWidth,
                            height: DesignTokens.Skeleton.bodyHeight
                        )
                        Spacer()
                        SkeletonShape(
                            width: DesignTokens.Skeleton.shortTextWidth,
                            height: DesignTokens.Skeleton.bodyHeight
                        )
                    }
                    .padding(.vertical, DesignTokens.ListRow.verticalPadding)
                }
            } header: {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }

            // Line sections: revenus, dépenses, épargne
            ForEach(0..<3, id: \.self) { _ in
                Section {
                    ForEach(0..<3, id: \.self) { _ in
                        // `TemplateLineRow`: disc, name over a single subtitle line that may
                        // carry a tag chip beside it, the amount, then the chevron.
                        HStack(spacing: DesignTokens.Spacing.sm) {
                            SkeletonCircle(size: DesignTokens.IconSize.listRow)

                            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                                SkeletonShape(
                                    width: DesignTokens.Skeleton.mediumTextWidth,
                                    height: DesignTokens.Skeleton.lineHeight
                                )
                                HStack(spacing: DesignTokens.Spacing.xs) {
                                    SkeletonShape(
                                        width: DesignTokens.Skeleton.shortTextWidth,
                                        height: DesignTokens.Skeleton.captionHeight
                                    )
                                    SkeletonShape(
                                        width: DesignTokens.Skeleton.numericWidth,
                                        height: DesignTokens.Skeleton.tagHeight,
                                        cornerRadius: .infinity
                                    )
                                }
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
                        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
                    }
                } header: {
                    HStack(spacing: DesignTokens.Spacing.xs) {
                        SkeletonShape(
                            width: DesignTokens.Skeleton.compactTextWidth,
                            height: DesignTokens.Skeleton.captionHeight
                        )
                        // The « · 3 » count that follows the section title.
                        SkeletonShape(
                            width: DesignTokens.Skeleton.numericWidth,
                            height: DesignTokens.Skeleton.captionHeight
                        )
                        Spacer()
                        SkeletonShape(
                            width: DesignTokens.Skeleton.shortTextWidth,
                            height: DesignTokens.Skeleton.captionHeight
                        )
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du modèle")
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
}
