import SwiftUI

struct TemplateDetailsView: View {
    let templateId: String
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel: TemplateDetailsViewModel
    @State private var selectedLineForEdit: TemplateLine?

    init(templateId: String) {
        self.templateId = templateId
        self._viewModel = State(initialValue: TemplateDetailsViewModel(templateId: templateId))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.template == nil {
                TemplateDetailsSkeletonView()
                    .transition(.opacity)
            } else if let error = viewModel.error, viewModel.template == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
                .transition(.opacity)
            } else if let template = viewModel.template {
                content(template: template)
                    .transition(.opacity)
            }
        }
        .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.isLoading)
        .navigationTitle(viewModel.template?.name ?? "Modèle")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadIfNeeded()
        }
        .sheet(item: $selectedLineForEdit) { line in
            EditTemplateLineSheet(
                templateLine: line,
                userCurrency: userSettingsStore.currency
            ) { updatedLine in
                Task { await viewModel.updateTemplateLine(updatedLine) }
            }
        }
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
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(PulpeTypography.caption2)
                            Text("Par défaut")
                                .font(PulpeTypography.caption2)
                                .fontWeight(.medium)
                        }
                        .foregroundStyle(Color.financialSavings)
                        .padding(.horizontal, DesignTokens.Spacing.sm)
                        .padding(.vertical, DesignTokens.Spacing.xs)
                        .background(Color.financialSavings.opacity(DesignTokens.Opacity.badgeBackground), in: Capsule())
                    }
                }
                .padding(.vertical, DesignTokens.Spacing.xs)
            }

            totalsSection

            // Lines by kind
            if !viewModel.incomeLines.isEmpty {
                templateLineSection(title: "Revenus", lines: viewModel.incomeLines, kind: .income)
            }

            if !viewModel.expenseLines.isEmpty {
                templateLineSection(title: "Dépenses", lines: viewModel.expenseLines, kind: .expense)
            }

            if !viewModel.savingLines.isEmpty {
                templateLineSection(title: "Épargne", lines: viewModel.savingLines, kind: .saving)
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
                Text(viewModel.totals.totalIncome.asSignedCurrency(userSettingsStore.currency, for: .income))
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
                Text(viewModel.totals.totalExpenses.asSignedCurrency(userSettingsStore.currency, for: .expense))
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
                Text(viewModel.totals.balance.asSignedCurrency(userSettingsStore.currency))
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
                TemplateLineRow(line: line) {
                    selectedLineForEdit = line
                }
            }
        } header: {
            HStack {
                Text(title)
                Spacer()
                let total = lines.reduce(Decimal.zero) { $0 + $1.amount }
                Text(total.asSignedCurrency(userSettingsStore.currency, for: kind))
                    .font(PulpeTypography.caption)
                    .sensitiveAmount()
            }
        }
    }
}

// MARK: - Template Line Row

struct TemplateLineRow: View {
    let line: TemplateLine
    let onEdit: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        Button(action: onEdit) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Circle()
                    .fill(line.kind.color.opacity(DesignTokens.Opacity.badgeBackground))
                    .frame(width: DesignTokens.IconSize.listRow, height: DesignTokens.IconSize.listRow)
                    .overlay {
                        Image(systemName: line.kind.icon)
                            .font(PulpeTypography.listRowTitle)
                            .foregroundStyle(line.kind.color)
                    }

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(line.name)
                        .font(PulpeTypography.listRowTitle)
                        .lineLimit(1)

                    RecurrenceBadge(line.recurrence, style: .compact)
                }

                Spacer()

                Text(line.amount.asSignedAmount(for: line.kind, in: userSettingsStore.currency))
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(line.kind.color)
                    .sensitiveAmount()
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Touche pour modifier")
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

    private let templateService = TemplateService.shared

    init(templateId: String) {
        self.templateId = templateId
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
}

// MARK: - Skeleton

private struct TemplateDetailsSkeletonView: View {
    var body: some View {
        List {
            // Info section
            Section {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SkeletonShape(width: 200, height: 14)
                    SkeletonShape(width: 80, height: 22, cornerRadius: DesignTokens.CornerRadius.sm)
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
                        SkeletonShape(width: 80, height: 14)
                        Spacer()
                        SkeletonShape(width: 80, height: 14)
                    }
                    .padding(.vertical, DesignTokens.ListRow.verticalPadding)
                }
            } header: {
                SkeletonShape(width: 90, height: 12)
            }

            // Budget line sections (2 sections)
            ForEach(0..<2, id: \.self) { _ in
                Section {
                    ForEach(0..<3, id: \.self) { _ in
                        HStack(spacing: DesignTokens.Spacing.md) {
                            SkeletonShape(
                                width: DesignTokens.IconSize.listRow,
                                height: DesignTokens.IconSize.listRow,
                                cornerRadius: DesignTokens.IconSize.listRow / 2
                            )
                            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                                SkeletonShape(width: 120, height: 14)
                                SkeletonShape(width: 55, height: 20, cornerRadius: DesignTokens.CornerRadius.sm)
                            }
                            Spacer()
                            SkeletonShape(width: 70, height: 14)
                        }
                        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
                    }
                } header: {
                    HStack {
                        SkeletonShape(width: 70, height: 12)
                        Spacer()
                        SkeletonShape(width: 80, height: 12)
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
}
