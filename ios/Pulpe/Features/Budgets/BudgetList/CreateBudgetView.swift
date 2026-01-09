import SwiftUI

struct CreateBudgetView: View {
    let month: Int
    let year: Int
    let onCreate: (Budget) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: CreateBudgetViewModel

    init(month: Int, year: Int, onCreate: @escaping (Budget) -> Void) {
        self.month = month
        self.year = year
        self.onCreate = onCreate
        self._viewModel = State(initialValue: CreateBudgetViewModel(month: month, year: year))
    }

    var body: some View {
        NavigationStack {
            Form {
                // Month display
                Section {
                    HStack {
                        Image(systemName: "calendar")
                            .foregroundStyle(Color.accentColor)

                        Text(viewModel.monthYearFormatted)
                            .font(.headline)
                    }
                } header: {
                    Text("Période")
                }

                // Template selection
                Section {
                    if viewModel.isLoadingTemplates {
                        HStack {
                            ProgressView()
                            Text("Chargement des modèles...")
                                .foregroundStyle(.secondary)
                        }
                    } else if viewModel.templates.isEmpty {
                        Text("Aucun modèle disponible")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(viewModel.templates) { template in
                            TemplateSelectionRow(
                                template: template,
                                totals: viewModel.templateTotals[template.id],
                                isSelected: viewModel.selectedTemplateId == template.id
                            ) {
                                viewModel.selectedTemplateId = template.id
                            }
                        }
                    }
                } header: {
                    Text("Modèle")
                } footer: {
                    Text("Le budget sera créé à partir du modèle sélectionné")
                }

                // Error
                if let error = viewModel.error {
                    Section {
                        ErrorBanner(message: error.localizedDescription) {
                            viewModel.error = nil
                        }
                    }
                }
            }
            .navigationTitle("Nouveau budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Créer") {
                        Task { await createBudget() }
                    }
                    .disabled(!viewModel.canCreate)
                }
            }
            .loadingOverlay(viewModel.isCreating, message: "Création...")
            .task {
                await viewModel.loadTemplates()
            }
        }
    }

    private func createBudget() async {
        if let budget = await viewModel.createBudget() {
            onCreate(budget)
            dismiss()
        }
    }
}

// MARK: - Template Row

struct TemplateSelectionRow: View {
    let template: BudgetTemplate
    let totals: BudgetFormulas.TemplateTotals?
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(template.name)
                            .font(.subheadline)
                            .fontWeight(.medium)

                        if template.isDefaultTemplate {
                            Text("Par défaut")
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.15), in: Capsule())
                                .foregroundStyle(Color.accentColor)
                        }
                    }

                    if let totals {
                        HStack(spacing: 12) {
                            Label(totals.totalIncome.asCompactCHF, systemImage: "arrow.down")
                                .font(.caption)
                                .foregroundStyle(.green)

                            Label(totals.totalExpenses.asCompactCHF, systemImage: "arrow.up")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }
                }

                Spacer()

                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                    .font(.title3)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - ViewModel

@Observable
final class CreateBudgetViewModel {
    let month: Int
    let year: Int

    private(set) var templates: [BudgetTemplate] = []
    private(set) var templateTotals: [String: BudgetFormulas.TemplateTotals] = [:]
    var selectedTemplateId: String?

    private(set) var isLoadingTemplates = false
    private(set) var isCreating = false
    var error: Error?

    private let templateService = TemplateService.shared
    private let budgetService = BudgetService.shared

    init(month: Int, year: Int) {
        self.month = month
        self.year = year
    }

    var monthYearFormatted: String {
        Date.from(month: month, year: year)?.monthYearFormatted ?? "\(month)/\(year)"
    }

    var canCreate: Bool {
        selectedTemplateId != nil && !isCreating && !isLoadingTemplates
    }

    @MainActor
    func loadTemplates() async {
        isLoadingTemplates = true

        do {
            templates = try await templateService.getAllTemplates()

            // Load totals for each template
            for template in templates {
                let lines = try await templateService.getTemplateLines(templateId: template.id)
                templateTotals[template.id] = BudgetFormulas.calculateTemplateTotals(lines: lines)
            }

            // Auto-select default template
            if let defaultTemplate = templates.first(where: { $0.isDefaultTemplate }) {
                selectedTemplateId = defaultTemplate.id
            } else if let first = templates.first {
                selectedTemplateId = first.id
            }
        } catch {
            self.error = error
        }

        isLoadingTemplates = false
    }

    @MainActor
    func createBudget() async -> Budget? {
        guard let templateId = selectedTemplateId else { return nil }

        isCreating = true
        error = nil

        do {
            let data = BudgetCreate(
                month: month,
                year: year,
                description: monthYearFormatted,
                templateId: templateId
            )

            let budget = try await budgetService.createBudget(data)
            isCreating = false
            return budget
        } catch {
            self.error = error
            isCreating = false
            return nil
        }
    }
}

#Preview {
    CreateBudgetView(month: 1, year: 2025) { budget in
        print("Created: \(budget)")
    }
}
