import SwiftUI

/// « Planifier plusieurs mois » (V2 `Mois-plusieurs`): a range, one template, and the grid
/// of the months it covers, those already there and those it creates, before validation.
struct PlanBudgetsView: View {
    let onSuccess: (BudgetGenerateResponse) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: PlanBudgetsViewModel
    @State private var activePicker: PeriodPicker?

    private enum PeriodPicker: Identifiable, Equatable {
        case start
        case end

        var id: Self { self }
    }

    init(
        payDayOfMonth: Int?,
        existingPeriods: Set<BudgetPeriod> = [],
        onSuccess: @escaping (BudgetGenerateResponse) -> Void
    ) {
        self.init(
            viewModel: PlanBudgetsViewModel(payDayOfMonth: payDayOfMonth, existingPeriods: existingPeriods),
            onSuccess: onSuccess
        )
    }

    init(viewModel: PlanBudgetsViewModel, onSuccess: @escaping (BudgetGenerateResponse) -> Void) {
        self.onSuccess = onSuccess
        self._viewModel = State(initialValue: viewModel)
    }

    private let gridColumns = Array(
        repeating: GridItem(.flexible(), spacing: DesignTokens.Spacing.sm),
        count: 3
    )

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    FormCard {
                        periodRow(AppLocale.string("Du"), period: viewModel.start, picker: .start)
                        FormRowDivider()
                        periodRow(AppLocale.string("Au"), period: viewModel.end, picker: .end)
                    }
                    templateSection

                    if let message = viewModel.validationMessage {
                        ErrorBanner(message: message)
                    } else {
                        monthsGrid
                    }

                    ImpactBlock(
                        title: AppLocale.string("Ton disponible actuel ne change pas"),
                        before: nil,
                        after: 0,
                        currency: .chf,
                        note: AppLocale.string(
                            "Chaque nouveau mois part avec les prévisions du modèle, plus son report."
                        ),
                        showsFigures: false
                    )

                    if let error = viewModel.error {
                        if viewModel.templates.isEmpty {
                            ErrorBanner(message: DomainErrorLocalizer.localize(error))
                            Button("Réessayer") {
                                Task { await viewModel.loadTemplates() }
                            }
                            .secondaryButtonStyle(size: .small)
                        } else {
                            ErrorBanner(message: DomainErrorLocalizer.localize(error)) {
                                viewModel.error = nil
                            }
                        }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.lg)
            }
            .scrollIndicators(.hidden)
            .background(Color.sheetBackground)
            .safeAreaInset(edge: .bottom, spacing: DesignTokens.Spacing.none) {
                BudgetSheetCTA(
                    title: AppLocale.string("Créer \(viewModel.newCount) mois"),
                    isEnabled: viewModel.canGenerate,
                    accessibilityIdentifier: "planBudgetsSubmit"
                ) {
                    Task { await generate() }
                }
            }
            .localizedNavigationTitle("Planifier plusieurs mois")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                        .disabled(viewModel.isGenerating)
                        .accessibilityIdentifier("planBudgetsClose")
                }
            }
            .loadingOverlay(viewModel.isGenerating, message: AppLocale.string("Planification..."))
            .task { await viewModel.loadTemplates() }
        }
        .standardSheetPresentation()
        .interactiveDismissDisabled(viewModel.isGenerating)
        .sheet(item: $activePicker) { picker in
            MonthYearPickerSheet(
                title: picker == .start ? AppLocale.string("Premier mois") : AppLocale.string("Dernier mois"),
                initial: picker == .start ? viewModel.start : viewModel.end,
                yearRange: picker == .start ? viewModel.yearRange : viewModel.endYearRange
            ) { period in
                if picker == .start {
                    viewModel.start = period
                } else {
                    viewModel.end = period
                }
            }
        }
    }

    private func periodRow(_ title: String, period: BudgetPeriod, picker: PeriodPicker) -> some View {
        Button { activePicker = picker } label: {
            BudgetFormValueRow(title: title, value: BudgetListPresentation.monthYear(period))
        }
        .plainPressedButtonStyle()
    }

    @ViewBuilder
    private var templateSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Avec quel modèle ?")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.xs)
                .accessibilityAddTraits(.isHeader)

            FormCard {
                if viewModel.isLoadingTemplates {
                    BudgetFormValueRow(
                        title: AppLocale.string("Chargement des modèles..."),
                        value: "",
                        showsChevron: false
                    )
                } else if viewModel.templates.isEmpty {
                    BudgetFormValueRow(
                        title: AppLocale.string("Aucun modèle disponible"),
                        value: "",
                        showsChevron: false
                    )
                } else {
                    // One row, the choice in a native menu: the grid below is what matters.
                    Menu {
                        Picker(AppLocale.string("Modèle"), selection: $viewModel.selectedTemplateId) {
                            ForEach(viewModel.templates) { template in
                                Text(template.name).tag(Optional(template.id))
                            }
                        }
                    } label: {
                        BudgetFormValueRow(
                            title: viewModel.selectedTemplate?.name ?? "",
                            value: viewModel.selectedTemplate?.isDefaultTemplate == true
                                ? AppLocale.string("Par défaut") : "",
                            emphasizesValue: false
                        )
                    }
                    .plainPressedButtonStyle()
                }
            }
        }
    }

    private var monthsGrid: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack {
                Text(AppLocale.string("\(viewModel.inclusiveCount) mois choisis"))
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                Spacer(minLength: DesignTokens.Spacing.sm)
                Text(AppLocale.string("\(PlanBudgetsViewModel.maximumCount) au maximum"))
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
            .monospacedDigit()
            .padding(.horizontal, DesignTokens.Spacing.xs)

            LazyVGrid(columns: gridColumns, spacing: DesignTokens.Spacing.sm) {
                ForEach(viewModel.plannedMonths, id: \.period) { month in
                    PlannedMonthTile(month: month)
                }
            }

            if let sentence = viewModel.coverageSentence {
                Text(sentence)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.horizontal, DesignTokens.Spacing.xs)
            }
        }
    }

    private func generate() async {
        guard let response = await viewModel.generate() else { return }
        dismiss()
        onSuccess(response)
    }
}

/// One month of the range: « oct. 27 / déjà là » on white, « nov. 27 / nouveau » in green.
private struct PlannedMonthTile: View {
    let month: PlanBudgetsViewModel.PlannedMonth

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxs) {
            Text(PlanBudgetsViewModel.shortLabel(month.period))
                .font(PulpeTypography.labelLarge)
            Text(month.exists ? AppLocale.string("déjà là") : AppLocale.string("nouveau"))
                .font(PulpeTypography.captionRegular)
        }
        .foregroundStyle(month.exists ? Color.textSecondary : Color.accentInk)
        .lineLimit(1)
        .minimumScaleFactor(DesignTokens.TextScale.compact)
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(
            month.exists ? Color.surface : Color.accentWash,
            in: .rect(cornerRadius: DesignTokens.CornerRadius.button)
        )
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
                .strokeBorder(
                    month.exists ? Color.outlineVariant : Color.pulpePrimary,
                    lineWidth: DesignTokens.BorderWidth.thin
                )
        }
        .accessibilityElement(children: .combine)
    }
}

@Observable @MainActor
final class PlanBudgetsViewModel {
    static let maximumCount = 36

    var start: BudgetPeriod
    var end: BudgetPeriod
    var selectedTemplateId: String?
    var error: Error?

    private(set) var templates: [BudgetTemplate] = []
    private(set) var isLoadingTemplates = false
    private(set) var isGenerating = false

    let yearRange: ClosedRange<Int>
    /// The months that already have a budget: the range skips them.
    let existingPeriods: Set<BudgetPeriod>
    private let loadTemplatesAction: @Sendable () async throws -> [BudgetTemplate]
    private let generateAction: @Sendable (BudgetGenerate) async throws -> BudgetGenerateResponse

    init(
        payDayOfMonth: Int?,
        existingPeriods: Set<BudgetPeriod> = [],
        now: Date = Date(),
        loadTemplates: @escaping @Sendable () async throws -> [BudgetTemplate] = {
            try await TemplateService.shared.getAllTemplates()
        },
        generate: @escaping @Sendable (BudgetGenerate) async throws -> BudgetGenerateResponse = {
            try await BudgetService.shared.generateBudgets($0)
        }
    ) {
        let current = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        self.start = current
        self.end = BudgetPeriodCalculator.periodFromIndex(
            BudgetPeriodCalculator.periodIndex(current) + 11
        )
        self.yearRange = current.year...(current.year + AppConfiguration.maxBudgetYearsAhead)
        self.existingPeriods = existingPeriods
        self.loadTemplatesAction = loadTemplates
        self.generateAction = generate
    }

    var inclusiveCount: Int {
        BudgetPeriodCalculator.periodIndex(end) - BudgetPeriodCalculator.periodIndex(start) + 1
    }

    var endYearRange: ClosedRange<Int> {
        let maximumEnd = BudgetPeriodCalculator.periodFromIndex(
            BudgetPeriodCalculator.periodIndex(start) + Self.maximumCount - 1
        )
        return start.year...maximumEnd.year
    }

    var validationMessage: String? {
        if inclusiveCount < 1 {
            return AppLocale.string("La période de fin doit suivre la période de début.")
        }
        if inclusiveCount > Self.maximumCount {
            return AppLocale.string("Choisis au maximum 36 périodes.")
        }
        return nil
    }

    var showsPeriodCount: Bool {
        validationMessage == nil
    }

    struct PlannedMonth: Equatable {
        let period: BudgetPeriod
        let exists: Bool
    }

    /// The range's months, each marked « déjà là » or « nouveau ». Empty while the range is invalid.
    var plannedMonths: [PlannedMonth] {
        guard validationMessage == nil else { return [] }
        let first = BudgetPeriodCalculator.periodIndex(start)
        return (first..<(first + inclusiveCount)).map { index in
            let period = BudgetPeriodCalculator.periodFromIndex(index)
            return PlannedMonth(period: period, exists: existingPeriods.contains(period))
        }
    }

    /// How many months the CTA creates: the range minus the months already there.
    var newCount: Int {
        plannedMonths.count { !$0.exists }
    }

    var coverageSentence: String? {
        let months = plannedMonths
        guard months.contains(where: \.exists) else { return nil }
        if newCount == 0 {
            return AppLocale.string("Ces mois existent déjà : rien à créer.")
        }
        return AppLocale.string("Les mois déjà là, je n'y touche pas. Les autres sont créés.")
    }

    var selectedTemplate: BudgetTemplate? {
        templates.first { $0.id == selectedTemplateId }
    }

    /// « oct. 27 »
    static func shortLabel(_ period: BudgetPeriod) -> String {
        guard let date = Date.from(month: period.month, year: period.year) else {
            return String(format: "%02d.%02d", period.month, period.year % 100)
        }
        return Formatters.dateFormatter("MMMyy").string(from: date)
    }

    var generateRequest: BudgetGenerate? {
        guard let selectedTemplateId, validationMessage == nil else { return nil }
        return BudgetGenerate(
            templateId: selectedTemplateId,
            startMonth: start.month,
            startYear: start.year,
            count: inclusiveCount
        )
    }

    var canGenerate: Bool {
        generateRequest != nil && newCount > 0 && !isLoadingTemplates && !isGenerating
    }

    func loadTemplates() async {
        isLoadingTemplates = true
        error = nil
        defer { isLoadingTemplates = false }

        do {
            templates = try await loadTemplatesAction()
            selectedTemplateId = templates.first(where: \.isDefaultTemplate)?.id ?? templates.first?.id
        } catch {
            self.error = error
        }
    }

    func generate() async -> BudgetGenerateResponse? {
        guard let request = generateRequest else { return nil }
        isGenerating = true
        error = nil
        defer { isGenerating = false }

        do {
            return try await generateAction(request)
        } catch {
            self.error = error
            return nil
        }
    }
}

enum BudgetGenerationResultAnnouncement {
    static func message(for response: BudgetGenerateResponse) -> String {
        let created = AppLocale.string("\(response.budgets.count) budgets créés")
        let skipped = AppLocale.string("\(response.skippedMonths.count) budgets déjà existants ignorés")
        return "\(created), \(skipped)"
    }
}

#Preview {
    PlanBudgetsView(payDayOfMonth: 25) { _ in }
        .environment(UserSettingsStore())
}
