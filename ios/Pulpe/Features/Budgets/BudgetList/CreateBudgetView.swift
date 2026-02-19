import SwiftUI

struct CreateBudgetView: View {
    let month: Int
    let year: Int
    let onCreate: (Budget) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: CreateBudgetViewModel
    @State private var hasAppeared = false

    init(month: Int, year: Int, onCreate: @escaping (Budget) -> Void) {
        self.month = month
        self.year = year
        self.onCreate = onCreate
        self._viewModel = State(initialValue: CreateBudgetViewModel(month: month, year: year))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    // Period header card
                    periodCard
                        .opacity(hasAppeared ? 1 : 0)
                        .offset(y: hasAppeared ? 0 : 15)

                    // Template selection
                    templateSection
                        .opacity(hasAppeared ? 1 : 0)
                        .offset(y: hasAppeared ? 0 : 15)

                    // Error display
                    if let error = viewModel.error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            viewModel.error = nil
                        }
                        .transition(.asymmetric(
                            insertion: .move(edge: .top).combined(with: .opacity),
                            removal: .opacity
                        ))
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, 32)
            }
            .scrollIndicators(.hidden)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Nouveau budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") {
                        dismiss()
                    }
                    .foregroundStyle(.secondary)
                }

                ToolbarItem(placement: .confirmationAction) {
                    createButton
                }
            }
            .loadingOverlay(viewModel.isCreating, message: "Création...")
            .task {
                await viewModel.loadTemplates()
                withAnimation(.easeOut(duration: 0.4).delay(0.1)) {
                    hasAppeared = true
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .presentationCornerRadius(24)
        .presentationBackground(Color(.systemGroupedBackground))
    }

    // MARK: - Create Button

    private var createButton: some View {
        Button {
            Task { await createBudget() }
        } label: {
            Text("Créer")
                .fontWeight(.semibold)
        }
        .disabled(!viewModel.canCreate)
    }

    // MARK: - Period Card

    private var periodCard: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            // Calendar icon with gradient background
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Color.pulpePrimary.opacity(0.15), Color.pulpePrimary.opacity(0.08)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 52, height: 52)

                Image(systemName: "calendar")
                    .font(.system(size: 22, weight: .medium))
                    .foregroundStyle(Color.pulpePrimary)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Période du budget")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)

                Text(viewModel.monthYearFormatted)
                    .font(.custom("Manrope-SemiBold", size: 20, relativeTo: .title3))
                    .foregroundStyle(.primary)
            }

            Spacer()

            // Month indicator badge (Swiss format: MM.YYYY)
            Text(String(format: "%02d.%d", month, year))
                .font(.custom("DMSans-Medium", size: 12, relativeTo: .caption)).monospacedDigit()
                .foregroundStyle(.secondary)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Color(.tertiarySystemGroupedBackground), in: Capsule())
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
        .shadow(DesignTokens.Shadow.subtle)
    }

    // MARK: - Template Section

    private var templateSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Section header
            HStack {
                Text("Choisir un modèle")
                    .font(.custom("Manrope-SemiBold", size: 17, relativeTo: .headline))

                Spacer()

                if viewModel.isLoadingTemplates {
                    ProgressView()
                        .scaleEffect(0.8)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xs)

            // Template list
            if viewModel.isLoadingTemplates && viewModel.templates.isEmpty {
                loadingTemplates
            } else if viewModel.templates.isEmpty {
                emptyTemplates
            } else {
                templateList
            }

            // Footer hint
            Text("Le budget sera créé avec les prévisions du modèle sélectionné")
                .font(PulpeTypography.caption)
                .foregroundStyle(.tertiary)
                .padding(.horizontal, DesignTokens.Spacing.xs)
                .padding(.top, DesignTokens.Spacing.xs)
        }
    }

    // MARK: - Loading Templates

    private var loadingTemplates: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            ForEach(0..<2, id: \.self) { _ in
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                    .fill(Color(.tertiarySystemGroupedBackground))
                    .frame(height: 80)
                    .shimmering()
            }
        }
    }

    // MARK: - Empty Templates

    private var emptyTemplates: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 32))
                .foregroundStyle(.tertiary)

            Text("Pas encore de modèle")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(.secondary)

            Text("Crée d'abord un modèle dans l'onglet Modèles")
                .font(PulpeTypography.caption)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }

    // MARK: - Template List

    private var templateList: some View {
        VStack(spacing: 10) {
            ForEach(Array(viewModel.templates.enumerated()), id: \.element.id) { index, template in
                TemplateSelectionCard(
                    template: template,
                    totals: viewModel.templateTotals[template.id],
                    isSelected: viewModel.selectedTemplateId == template.id
                ) {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        viewModel.selectedTemplateId = template.id
                    }
                }
                .opacity(hasAppeared ? 1 : 0)
                .offset(y: hasAppeared ? 0 : 10)
                .animation(
                    .spring(response: 0.4, dampingFraction: 0.8).delay(Double(index) * 0.05 + 0.15),
                    value: hasAppeared
                )
            }
        }
    }

    // MARK: - Actions

    private func createBudget() async {
        if let budget = await viewModel.createBudget() {
            onCreate(budget)
            dismiss()
        }
    }
}

// MARK: - Template Selection Card

struct TemplateSelectionCard: View {
    let template: BudgetTemplate
    let totals: BudgetFormulas.TemplateTotals?
    let isSelected: Bool
    let onSelect: () -> Void

    @State private var isPressed = false

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 14) {
                // Selection indicator
                selectionIndicator

                // Template info
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text(template.name)
                            .font(.custom("Manrope-SemiBold", size: 15, relativeTo: .subheadline))
                            .foregroundStyle(.primary)

                        if template.isDefaultTemplate {
                            defaultBadge
                        }
                    }

                    if let totals {
                        totalsRow(totals)
                    }
                }

                Spacer()
            }
            .padding(14)
            .background(cardBackground)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
            .overlay(cardBorder)
            .shadow(isSelected ? DesignTokens.Shadow.card : DesignTokens.Shadow.subtle)
            .scaleEffect(isPressed ? 0.98 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isPressed)
        }
        .buttonStyle(.plain)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
        .accessibilityLabel("\(template.name)\(template.isDefaultTemplate ? ", modèle par défaut" : "")")
        .accessibilityHint(isSelected ? "Sélectionné" : "Appuie pour sélectionner")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    // MARK: - Selection Indicator

    private var selectionIndicator: some View {
        ZStack {
            Circle()
                .strokeBorder(isSelected ? Color.pulpePrimary : Color(.separator), lineWidth: 2)
                .frame(width: 24, height: 24)

            if isSelected {
                Circle()
                    .fill(Color.pulpePrimary)
                    .frame(width: 14, height: 14)
                    .transition(.scale.combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.3, dampingFraction: 0.6), value: isSelected)
    }

    // MARK: - Default Badge

    private var defaultBadge: some View {
        Text("Par défaut")
            .font(.custom("Manrope-SemiBold", size: 10, relativeTo: .caption2))
            .foregroundStyle(Color.pulpePrimary)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
    }

    // MARK: - Totals Row

    private func totalsRow(_ totals: BudgetFormulas.TemplateTotals) -> some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            HStack(spacing: 4) {
                Image(systemName: "arrow.down.circle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.financialIncome)

                Text(totals.totalIncome.asCompactCHF)
                    .font(.custom("Manrope-Medium", size: 12, relativeTo: .caption))
                    .foregroundStyle(Color.financialIncome)
                    .sensitiveAmount()
            }

            HStack(spacing: 4) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.financialExpense)

                Text(totals.totalExpenses.asCompactCHF)
                    .font(.custom("Manrope-Medium", size: 12, relativeTo: .caption))
                    .foregroundStyle(Color.financialExpense)
                    .sensitiveAmount()
            }

            // Balance indicator
            HStack(spacing: 4) {
                Image(systemName: totals.balance >= 0 ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget)

                Text(totals.balance.asCompactCHF)
                    .font(.custom("Manrope-Medium", size: 12, relativeTo: .caption))
                    .foregroundStyle(totals.balance >= 0 ? Color.financialSavings : Color.financialOverBudget)
                    .sensitiveAmount()
            }
        }
    }

    // MARK: - Card Background

    @ViewBuilder
    private var cardBackground: some View {
        if isSelected {
            LinearGradient(
                colors: [
                    Color.pulpePrimary.opacity(0.06),
                    Color.pulpePrimary.opacity(0.02)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        } else {
            Color(.secondarySystemGroupedBackground)
        }
    }

    // MARK: - Card Border

    private var cardBorder: some View {
        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
            .stroke(
                isSelected ? Color.pulpePrimary.opacity(0.4) : Color(.separator).opacity(0.2),
                lineWidth: isSelected ? 1.5 : 0.5
            )
    }
}

// MARK: - Shimmer Effect

extension View {
    @ViewBuilder
    func shimmering() -> some View {
        self.modifier(ShimmerModifier())
    }
}

private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .overlay(
                GeometryReader { geometry in
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0),
                            Color.white.opacity(0.3),
                            Color.white.opacity(0)
                        ],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: geometry.size.width * 0.6)
                    .offset(x: phase * geometry.size.width * 1.6 - geometry.size.width * 0.3)
                }
            )
            .mask(content)
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

// MARK: - ViewModel

@Observable @MainActor
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
        Date.from(month: month, year: year)?.monthYearFormatted ?? String(format: "%02d.%d", month, year)
    }

    var canCreate: Bool {
        selectedTemplateId != nil && !isCreating && !isLoadingTemplates
    }

    func loadTemplates() async {
        isLoadingTemplates = true

        do {
            templates = try await templateService.getAllTemplates()

            // Load totals for each template in parallel
            await withTaskGroup(of: (String, BudgetFormulas.TemplateTotals?).self) { group in
                for template in templates {
                    group.addTask {
                        let lines = try? await self.templateService.getTemplateLines(templateId: template.id)
                        let totals = lines.map { BudgetFormulas.calculateTemplateTotals(lines: $0) }
                        return (template.id, totals)
                    }
                }
                for await (id, totals) in group {
                    if let totals { self.templateTotals[id] = totals }
                }
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

// MARK: - Preview

#Preview("Create Budget") {
    CreateBudgetView(month: 1, year: 2025) { budget in
        print("Created: \(budget)")
    }
}
