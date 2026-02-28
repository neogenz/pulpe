import SwiftUI

struct TemplateDetailsView: View {
    let templateId: String
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
            await viewModel.loadDetails()
        }
        .sheet(item: $selectedLineForEdit) { line in
            EditTemplateLineSheet(templateLine: line) { updatedLine in
                Task { await viewModel.updateTemplateLine(updatedLine) }
            }
        }
    }

    private func content(template: BudgetTemplate) -> some View {
        List {
            // Template info
            Section {
                LabeledContent("Nom", value: template.name)

                if let description = template.description, !description.isEmpty {
                    LabeledContent("Description", value: description)
                }

                LabeledContent("Par défaut", value: template.isDefaultTemplate ? "Oui" : "Non")
            } header: {
                Text("Informations")
            }

            totalsSection

            // Lines by kind
            if !viewModel.incomeLines.isEmpty {
                templateLineSection(title: "Revenus", lines: viewModel.incomeLines)
            }

            if !viewModel.expenseLines.isEmpty {
                templateLineSection(title: "Dépenses", lines: viewModel.expenseLines)
            }

            if !viewModel.savingLines.isEmpty {
                templateLineSection(title: "Épargne", lines: viewModel.savingLines)
            }
        }
        .refreshable {
            await viewModel.loadDetails()
        }
    }

    private var totalsSection: some View {
        Section {
            HStack {
                Label("Revenus", systemImage: "arrow.down.circle")
                    .foregroundStyle(Color.financialIncome)
                Spacer()
                Text(viewModel.totals.totalIncome.asCHF)
                    .sensitiveAmount()
            }

            HStack {
                Label("Dépenses", systemImage: "arrow.up.circle")
                    .foregroundStyle(Color.financialExpense)
                Spacer()
                Text(viewModel.totals.totalExpenses.asCHF)
                    .sensitiveAmount()
            }

            HStack {
                Label("Solde", systemImage: "banknote")
                    .fontWeight(.semibold)
                Spacer()
                Text(viewModel.totals.balance.asCHF)
                    .foregroundStyle(
                        viewModel.totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget
                    )
                    .fontWeight(.semibold)
                    .sensitiveAmount()
            }
        } header: {
            Text("Récapitulatif")
        }
    }

    private func templateLineSection(title: String, lines: [TemplateLine]) -> some View {
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
                Text(lines.reduce(Decimal.zero) { $0 + $1.amount }.asCHF)
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

    var body: some View {
        Button(action: onEdit) {
            HStack {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    Text(line.name)
                        .font(PulpeTypography.subheadline)

                    RecurrenceBadge(line.recurrence, style: .compact)
                }

                Spacer()

                CurrencyText(line.amount)
                    .foregroundStyle(line.kind.color)
            }
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
                ForEach(0..<2, id: \.self) { _ in
                    HStack {
                        SkeletonShape(width: 60, height: 14)
                        Spacer()
                        SkeletonShape(width: 120, height: 14)
                    }
                }
            } header: {
                SkeletonShape(width: 100, height: 12)
            }

            // Totals section
            Section {
                ForEach(0..<3, id: \.self) { _ in
                    HStack {
                        SkeletonShape(width: 24, height: 24, cornerRadius: DesignTokens.CornerRadius.xs)
                        SkeletonShape(width: 80, height: 14)
                        Spacer()
                        SkeletonShape(width: 80, height: 14)
                    }
                }
            } header: {
                SkeletonShape(width: 90, height: 12)
            }

            // Budget line sections (2 sections)
            ForEach(0..<2, id: \.self) { _ in
                Section {
                    ForEach(0..<3, id: \.self) { _ in
                        HStack {
                            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                                SkeletonShape(width: 120, height: 14)
                                SkeletonShape(width: 70, height: 11)
                            }
                            Spacer()
                            SkeletonShape(width: 70, height: 14)
                        }
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
}
