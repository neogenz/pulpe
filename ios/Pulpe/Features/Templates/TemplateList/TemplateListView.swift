import SwiftUI

struct TemplateListView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = TemplateListViewModel()
    @State private var showCreateTemplate = false
    @State private var templateToDelete: BudgetTemplate?
    @State private var showDeleteAlert = false
    @State private var deleteWarningTrigger = false

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.templates.isEmpty {
                LoadingView(message: "Récupération de tes modèles...")
            } else if let error = viewModel.error, viewModel.templates.isEmpty {
                ErrorView(error: error) {
                    await viewModel.loadTemplates()
                }
            } else if viewModel.templates.isEmpty {
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Image(systemName: "doc.on.doc")
                        .font(.system(size: 48))
                        .foregroundStyle(Color.textTertiary)
                    Text("Aucun modèle")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Les modèles vous permettent de créer des budgets rapidement")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textTertiary)
                        .multilineTextAlignment(.center)
                    Button("Créer un modèle") {
                        showCreateTemplate = true
                    }
                    .primaryButtonStyle()
                }
                .padding(DesignTokens.Spacing.xxxl)
            } else {
                templateList
            }
        }
        .navigationTitle("Modèles")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showCreateTemplate = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(viewModel.isLimitReached)
            }
        }
        .sheet(isPresented: $showCreateTemplate) {
            CreateTemplateView { template in
                viewModel.addTemplate(template)
                appState.templatePath.append(TemplateDestination.details(templateId: template.id))
            }
        }
        .refreshable {
            await viewModel.loadTemplates()
        }
        .task {
            await viewModel.loadTemplates()
        }
    }

    private var templateList: some View {
        List {
            Section {
                ForEach(viewModel.templates) { template in
                    TemplateRow(template: template) {
                        appState.templatePath.append(TemplateDestination.details(templateId: template.id))
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button {
                            deleteWarningTrigger.toggle()
                            templateToDelete = template
                            showDeleteAlert = true
                        } label: {
                            Label("Supprimer", systemImage: "trash")
                        }
                        .tint(Color.errorPrimary)
                    }
                }
            } footer: {
                Text("\(viewModel.templates.count)/\(AppConfiguration.maxTemplates) modèles")
                    .foregroundStyle(.secondary)
            }
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .sensoryFeedback(.warning, trigger: deleteWarningTrigger)
        .alert(
            "Supprimer ce modèle ?",
            isPresented: $showDeleteAlert,
            presenting: templateToDelete
        ) { template in
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) {
                Task { await viewModel.deleteTemplate(template) }
            }
        } message: { _ in
            Text("Cette action est irréversible.")
        }
    }
}

// MARK: - Template Row

struct TemplateRow: View {
    let template: BudgetTemplate
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    HStack {
                        Text(template.name)
                            .font(PulpeTypography.headline)

                        if template.isDefaultTemplate {
                            Text("Par défaut")
                                .font(PulpeTypography.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.accentColor.opacity(0.15), in: Capsule())
                                .foregroundStyle(Color.accentColor)
                        }
                    }

                    if let description = template.description, !description.isEmpty {
                        Text(description)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class TemplateListViewModel {
    private(set) var templates: [BudgetTemplate] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    private let templateService = TemplateService.shared

    var isLimitReached: Bool {
        templates.count >= AppConfiguration.maxTemplates
    }

    func loadTemplates() async {
        isLoading = true
        error = nil

        do {
            templates = try await templateService.getAllTemplates()
        } catch {
            self.error = error
        }

        isLoading = false
    }

    func addTemplate(_ template: BudgetTemplate) {
        templates.append(template)
    }

    func deleteTemplate(_ template: BudgetTemplate) async {
        // Check usage first
        do {
            let usage = try await templateService.checkTemplateUsage(id: template.id)
            if usage.isUsed {
                error = APIError.conflict(message: "Ce modèle est utilisé par \(usage.budgetCount) budget(s)")
                return
            }

            try await templateService.deleteTemplate(id: template.id)
            templates.removeAll { $0.id == template.id }
        } catch {
            self.error = error
        }
    }
}

#Preview {
    NavigationStack {
        TemplateListView()
    }
    .environment(AppState())
}
