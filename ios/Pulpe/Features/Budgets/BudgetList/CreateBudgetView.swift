import SwiftUI

/// « Nouveau mois » (V2 `Mois-nouveau`): the month and its dates, the template it starts
/// from with each template's opening disponible, and what the new month will hold.
struct CreateBudgetView: View {
    let onCreate: (Budget) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel: CreateBudgetViewModel
    @State private var showCreateTemplate = false
    @State private var showsMonthPicker = false

    init(month: Int, year: Int, existingPeriods: Set<BudgetPeriod> = [], onCreate: @escaping (Budget) -> Void) {
        self.onCreate = onCreate
        self._viewModel = State(
            initialValue: CreateBudgetViewModel(month: month, year: year, existingPeriods: existingPeriods)
        )
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    periodCard
                    templateSection

                    if let balance = viewModel.selectedBalance {
                        ImpactBlock(
                            title: AppLocale.string("Disponible à dépenser en \(viewModel.monthYearFormatted)"),
                            before: nil,
                            after: balance,
                            currency: currency,
                            note: AppLocale.string(
                                "Plus le report du mois précédent. Ton disponible actuel ne change pas."
                            )
                        )
                    }

                    if let error = viewModel.error {
                        ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                            viewModel.error = nil
                        }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .scrollIndicators(.hidden)
            .background(Color.sheetBackground)
            .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) {
                BudgetSheetCTA(
                    title: AppLocale.string("Créer \(viewModel.monthYearFormatted)"),
                    isEnabled: viewModel.canCreate,
                    accessibilityIdentifier: "createBudgetSubmit"
                ) {
                    Task { await createBudget() }
                }
            }
            .localizedNavigationTitle("Nouveau mois")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
            .loadingOverlay(viewModel.isCreating, message: AppLocale.string("Création..."))
            .task { await viewModel.loadTemplates() }
        }
        .standardSheetPresentation()
        .sheet(isPresented: $showCreateTemplate) {
            CreateTemplateView { _ in
                Task(name: "CreateBudget.reloadTemplates") { await viewModel.loadTemplates() }
            }
        }
        .sheet(isPresented: $showsMonthPicker) {
            let firstYear = Calendar.current.component(.year, from: Date())
            MonthYearPickerSheet(
                title: AppLocale.string("Mois"),
                initial: viewModel.period,
                yearRange: min(firstYear, viewModel.period.year)...(firstYear + AppConfiguration.maxBudgetYearsAhead)
            ) { viewModel.period = $0 }
        }
    }

    // MARK: - Period

    private var periodCard: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            periodRows
            if viewModel.periodAlreadyExists {
                Text(AppLocale.string("Un budget existe déjà pour cette période — choisis un autre mois"))
                    .font(PulpeTypography.footnote)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }
        }
    }

    private var periodRows: some View {
        FormCard {
            Button { showsMonthPicker = true } label: {
                BudgetFormValueRow(title: AppLocale.string("Mois"), value: viewModel.monthYearFormatted)
            }
            .plainPressedButtonStyle()
            .accessibilityIdentifier("createBudgetMonthRow")
            FormRowDivider()
            BudgetFormValueRow(
                title: AppLocale.string("Période"),
                // The month page's own subtitle: « 25 oct. au 24 nov. ».
                value: BudgetDetailsView.periodSubtitle(
                    month: viewModel.period.month,
                    year: viewModel.period.year,
                    payDayOfMonth: userSettingsStore.payDayOfMonth
                ),
                emphasizesValue: false,
                showsChevron: false
            )
        }
    }

    // MARK: - Templates

    private var templateSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Avec quel modèle ?")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.xs)
                .accessibilityAddTraits(.isHeader)

            if viewModel.isLoadingTemplates && viewModel.templates.isEmpty {
                SkeletonShape(height: DesignTokens.ListRow.minHeight * 2, cornerRadius: DesignTokens.CornerRadius.card)
                    .shimmering()
            } else if viewModel.templates.isEmpty {
                emptyTemplates
            } else {
                FormCard {
                    ForEach(viewModel.templates) { template in
                        if template.id != viewModel.templates.first?.id {
                            FormRowDivider()
                        }
                        templateRow(template)
                    }
                }
                Text("Le mois reprend les prévisions du modèle. Tu pourras les ajuster ensuite.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }
        }
    }

    private func templateRow(_ template: BudgetTemplate) -> some View {
        let isSelected = viewModel.selectedTemplateId == template.id
        return Button {
            viewModel.selectedTemplateId = template.id
        } label: {
            TemplateChoiceRow(
                template: template,
                subtitle: BudgetListPresentation.templateSubtitle(
                    template, lineCount: viewModel.templateLineCounts[template.id]
                ),
                balance: viewModel.templateTotals[template.id]?.balance,
                currency: currency,
                isSelected: isSelected
            )
        }
        .plainPressedButtonStyle()
        .sensoryFeedback(.selection, trigger: isSelected)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }

    private var emptyTemplates: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text("Pas encore de modèle")
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textPrimary)
            Text("Crée-en un pour préparer ton budget")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
            Button("Créer un modèle") {
                showCreateTemplate = true
            }
            .secondaryButtonStyle(size: .small)
        }
        .frame(maxWidth: .infinity)
        .padding(DesignTokens.Spacing.xl)
        .pulpeSurfaceCard()
    }

    // MARK: - Actions

    private func createBudget() async {
        if let budget = await viewModel.createBudget() {
            AnalyticsService.shared.capture(.budgetCreated)
            onCreate(budget)
            dismiss()
        }
    }
}

// MARK: - Template Choice Row

/// One template to start from: its name, « Par défaut · 11 lignes », the disponible it
/// opens with, and a check on the chosen one.
struct TemplateChoiceRow: View {
    let template: BudgetTemplate
    let subtitle: String?
    let balance: Decimal?
    let currency: SupportedCurrency
    let isSelected: Bool

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(template.name)
                    .font(PulpeTypography.rowTitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                if let subtitle {
                    Text(subtitle)
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let balance {
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                    Text(verbatim: balance.asAmount(for: currency))
                        .font(PulpeTypography.rowAmount)
                        .foregroundStyle(balance < 0 ? Color.financialOverBudget : Color.textPrimary)
                        .lineLimit(1)
                        .sensitiveAmount()
                    Text("disponible")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Image(systemName: "checkmark")
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.pulpePrimary)
                .opacity(isSelected ? 1 : 0)
                .accessibilityHidden(true)
        }
        .padding(.vertical, DesignTokens.ListRow.verticalPadding)
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class CreateBudgetViewModel {
    var period: BudgetPeriod

    private(set) var templates: [BudgetTemplate] = []
    private(set) var templateTotals: [String: BudgetFormulas.TemplateTotals] = [:]
    private(set) var templateLineCounts: [String: Int] = [:]
    var selectedTemplateId: String?

    private(set) var isLoadingTemplates = false
    private(set) var isCreating = false
    var error: Error?

    private let templateService = TemplateService.shared
    private let budgetService = BudgetService.shared

    private let existingPeriods: Set<BudgetPeriod>

    init(month: Int, year: Int, existingPeriods: Set<BudgetPeriod> = []) {
        self.period = BudgetPeriod(month: month, year: year)
        self.existingPeriods = existingPeriods
    }

    var monthYearFormatted: String {
        BudgetListPresentation.monthYear(period)
    }

    /// What the chosen template opens the month with.
    var selectedBalance: Decimal? {
        selectedTemplateId.flatMap { templateTotals[$0]?.balance }
    }

    var periodAlreadyExists: Bool { existingPeriods.contains(period) }

    var canCreate: Bool {
        selectedTemplateId != nil && !periodAlreadyExists && !isCreating && !isLoadingTemplates
    }

    func loadTemplates() async {
        isLoadingTemplates = true

        do {
            templates = try await templateService.getAllTemplates()

            // Load totals for each template in parallel
            await withTaskGroup(of: (String, BudgetFormulas.TemplateTotals?, Int?).self) { group in
                for template in templates {
                    group.addTask {
                        let lines = try? await self.templateService.getTemplateLines(templateId: template.id)
                        let totals = lines.map { BudgetFormulas.calculateTemplateTotals(lines: $0) }
                        return (template.id, totals, lines?.count)
                    }
                }
                for await (id, totals, count) in group {
                    if let totals { self.templateTotals[id] = totals }
                    if let count { self.templateLineCounts[id] = count }
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
                month: period.month,
                year: period.year,
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
