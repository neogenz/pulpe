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
                LoadingView(message: "Chargement...")
            } else if let error = viewModel.error, viewModel.template == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
            } else if let template = viewModel.template {
                content(template: template)
            }
        }
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

            // Totals
            Section {
                HStack {
                    Label("Revenus", systemImage: "arrow.down.circle")
                        .foregroundStyle(.green)
                    Spacer()
                    Text(viewModel.totals.totalIncome.asCHF)
                }

                HStack {
                    Label("Dépenses", systemImage: "arrow.up.circle")
                        .foregroundStyle(.red)
                    Spacer()
                    Text(viewModel.totals.totalExpenses.asCHF)
                }

                HStack {
                    Label("Solde", systemImage: "banknote")
                        .fontWeight(.semibold)
                    Spacer()
                    Text(viewModel.totals.balance.asCHF)
                        .foregroundStyle(viewModel.totals.balance >= 0 ? .green : .red)
                        .fontWeight(.semibold)
                }
            } header: {
                Text("Récapitulatif")
            }

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
                    .font(.caption)
            }
        }
    }
}

// MARK: - Template Line Row

struct TemplateLineRow: View {
    let line: TemplateLine
    let onEdit: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(line.name)
                    .font(.subheadline)

                RecurrenceBadge(line.recurrence, style: .compact)
            }

            Spacer()

            CurrencyText(line.amount)
                .foregroundStyle(line.kind.color)
        }
        .contentShape(Rectangle())
        .onTapGesture { onEdit() }
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Toucher pour modifier")
    }
}

// MARK: - ViewModel

@Observable
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

    @MainActor
    func loadDetails() async {
        isLoading = true
        error = nil

        do {
            async let templateTask = templateService.getTemplate(id: templateId)
            async let linesTask = templateService.getTemplateLines(templateId: templateId)

            template = try await templateTask
            lines = try await linesTask
        } catch {
            self.error = error
        }

        isLoading = false
    }

    @MainActor
    func updateTemplateLine(_ line: TemplateLine) async {
        // Optimistic update
        if let index = lines.firstIndex(where: { $0.id == line.id }) {
            lines[index] = line
        }

        // Reload to sync with server
        await loadDetails()
    }
}

#Preview {
    NavigationStack {
        TemplateDetailsView(templateId: "test")
    }
}
